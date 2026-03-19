-- ============================================================
-- sp_orders.sql
-- Procedimientos almacenados del módulo de Comandas (POS + KDS)
-- Dependencias: 05_orders.sql, 03_inventory.sql, 04_menu.sql
--
-- Arquitectura de descuento de inventario (2 pasos):
--   1. sp_pos_submit_order  → registra la comanda, NO descuenta inventario
--   2. sp_pos_collect_item  → el mesero recolecta, descuenta en ese momento
--
-- Esto permite que el KDS valide antes de que el mesero lleve el plato.
-- ============================================================

-- ── SUBMIT ORDER (Comanda) ────────────────────────────────────
-- Si la mesa ya tiene una orden OPEN, agrega items a ella.
-- Enruta cada item a PENDING_KITCHEN (tiene receta) o PENDING_FLOOR (sin receta).
DROP PROCEDURE IF EXISTS public.sp_pos_submit_order;

CREATE OR REPLACE PROCEDURE public.sp_pos_submit_order(p_payload JSONB)
LANGUAGE plpgsql AS $$
DECLARE
    v_waiter_code    VARCHAR;
    v_table_code     VARCHAR;
    v_diners         INT;
    v_items          JSONB;
    v_item           JSONB;

    v_waiter_id      UUID;
    v_table_id       UUID;
    v_order_id       UUID;
    v_order_code     VARCHAR;
    v_total          DECIMAL := 0;

    v_dish_code      VARCHAR;
    v_dish_id        UUID;
    v_dish_price     DECIMAL;
    v_has_recipe     BOOLEAN;
    v_qty            INT;
    v_notes          TEXT;
    v_initial_status VARCHAR(20);
BEGIN
    v_waiter_code := p_payload->>'waiterCode';
    v_table_code  := p_payload->>'tableCode';
    v_diners      := (p_payload->>'diners')::INT;
    v_items       := p_payload->'items';

    SELECT id INTO v_waiter_id FROM public.employees WHERE employee_number = v_waiter_code;
    IF v_waiter_id IS NULL THEN
        RAISE EXCEPTION 'Mesero no encontrado: %', v_waiter_code;
    END IF;

    SELECT id INTO v_table_id FROM public.restaurant_tables WHERE code = v_table_code;
    IF v_table_id IS NULL THEN
        RAISE EXCEPTION 'Mesa no encontrada: %', v_table_code;
    END IF;

    -- Reutiliza la orden abierta si existe, si no crea una nueva
    SELECT id INTO v_order_id
    FROM public.order_headers
    WHERE table_id = v_table_id AND status = 'OPEN';

    IF v_order_id IS NULL THEN
        v_order_code := 'ORD-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDDHH24MISSMS');
        INSERT INTO public.order_headers (code, table_id, waiter_id, diners, status, total)
        VALUES (v_order_code, v_table_id, v_waiter_id, COALESCE(v_diners, 1), 'OPEN', 0)
        RETURNING id INTO v_order_id;
    END IF;

    SELECT total INTO v_total FROM public.order_headers WHERE id = v_order_id;
    v_total := COALESCE(v_total, 0);

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
        v_dish_code := v_item->>'dishCode';
        v_qty       := (v_item->>'quantity')::INT;
        v_notes     := v_item->>'notes';

        SELECT id, price, has_recipe
        INTO v_dish_id, v_dish_price, v_has_recipe
        FROM public.menu_dishes WHERE code = v_dish_code;

        IF v_dish_id IS NULL THEN
            RAISE EXCEPTION 'Platillo no encontrado: %', v_dish_code;
        END IF;

        v_total := v_total + (v_dish_price * v_qty);

        -- Enrutamiento KDS: cocina solo si tiene receta
        v_initial_status := CASE WHEN v_has_recipe = true THEN 'PENDING_KITCHEN' ELSE 'PENDING_FLOOR' END;

        INSERT INTO public.order_items (order_id, dish_id, quantity, unit_price, subtotal, notes, status)
        VALUES (v_order_id, v_dish_id, v_qty, v_dish_price, (v_dish_price * v_qty), v_notes, v_initial_status);
    END LOOP;

    UPDATE public.order_headers SET total = v_total WHERE id = v_order_id;
END;
$$;


-- ── COLLECT ITEM (Recolección y descuento de inventario) ──────
-- El mesero confirma que lleva el plato a la mesa.
-- En este momento se descuenta del inventario (LOC-COCINA o LOC-PISO).
DROP PROCEDURE IF EXISTS public.sp_pos_collect_item;

CREATE OR REPLACE PROCEDURE public.sp_pos_collect_item(
    p_item_id    UUID,
    p_waiter_code VARCHAR
)
LANGUAGE plpgsql AS $$
DECLARE
    v_order_item        RECORD;
    v_waiter_id         UUID;
    v_kitchen_loc_id    UUID;
    v_floor_loc_id      UUID;
    v_has_recipe        BOOLEAN;
    v_qty               INT;
    v_dish_id           UUID;
    v_origin_loc_id     UUID;
    v_recipe_ingredient RECORD;
    v_direct_item_id    UUID;
BEGIN
    SELECT id INTO v_waiter_id FROM public.employees WHERE employee_number = p_waiter_code;
    IF v_waiter_id IS NULL THEN
        RAISE EXCEPTION 'Mesero no encontrado: %', p_waiter_code;
    END IF;

    SELECT id INTO v_kitchen_loc_id FROM public.inventory_locations WHERE code = 'LOC-COCINA';
    IF v_kitchen_loc_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación LOC-COCINA no encontrada';
    END IF;

    SELECT id INTO v_floor_loc_id FROM public.inventory_locations WHERE code = 'LOC-PISO';
    IF v_floor_loc_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación LOC-PISO no encontrada';
    END IF;

    SELECT oi.id, oi.dish_id, oi.quantity, oi.status, oi.order_id, md.has_recipe
    INTO v_order_item
    FROM public.order_items oi
    JOIN public.menu_dishes md ON oi.dish_id = md.id
    WHERE oi.id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de orden no encontrado: %', p_item_id;
    END IF;

    IF v_order_item.status NOT IN ('READY', 'PENDING_FLOOR') THEN
        RAISE EXCEPTION 'El item no está listo para recolección. Status actual: %', v_order_item.status;
    END IF;

    v_dish_id    := v_order_item.dish_id;
    v_qty        := v_order_item.quantity;
    v_has_recipe := v_order_item.has_recipe;

    IF v_has_recipe = true THEN
        -- Platillos con receta: descontar ingredientes de LOC-COCINA
        v_origin_loc_id := v_kitchen_loc_id;

        FOR v_recipe_ingredient IN
            SELECT item_id, quantity_required
            FROM public.dish_recipes
            WHERE dish_id = v_dish_id
        LOOP
            INSERT INTO public.inventory_kardex (
                item_id, from_location_id, transaction_type, quantity, reference_id
            ) VALUES (
                v_recipe_ingredient.item_id, v_origin_loc_id,
                'OUT', v_recipe_ingredient.quantity_required * v_qty,
                v_order_item.order_id::VARCHAR
            );

            UPDATE public.inventory_stock_locations
            SET stock = stock - (v_recipe_ingredient.quantity_required * v_qty)
            WHERE item_id = v_recipe_ingredient.item_id AND location_id = v_origin_loc_id;
        END LOOP;

    ELSE
        -- Productos directos (sin receta): descontar de LOC-PISO
        v_origin_loc_id := v_floor_loc_id;

        SELECT item_id INTO v_direct_item_id
        FROM public.dish_recipes WHERE dish_id = v_dish_id LIMIT 1;

        IF v_direct_item_id IS NOT NULL THEN
            INSERT INTO public.inventory_kardex (
                item_id, from_location_id, transaction_type, quantity, reference_id
            ) VALUES (
                v_direct_item_id, v_origin_loc_id,
                'OUT', v_qty,
                v_order_item.order_id::VARCHAR
            );

            UPDATE public.inventory_stock_locations
            SET stock = stock - v_qty
            WHERE item_id = v_direct_item_id AND location_id = v_origin_loc_id;
        END IF;
    END IF;

    UPDATE public.order_items
    SET status = 'COLLECTED'
    WHERE id = p_item_id;
END;
$$;
