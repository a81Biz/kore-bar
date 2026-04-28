-- ============================================================
-- sp_faltantes.sql
-- SPs para los tres gaps:
--   A) sp_generate_purchase_suggestions — algoritmo de pedidos óptimos
--   B) sp_pos_submit_order actualizado  — routing con route_to_kds
--   C) No requiere SP adicional; usa vw_absence_deductions directamente
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- A) ALGORITMO AUTOMÁTICO DE PEDIDOS A PROVEEDORES
-- ════════════════════════════════════════════════════════════
--
-- Lógica:
--   1. Identificar items con stock_en_bodega <= minimum_stock
--   2. Por cada item, elegir el proveedor óptimo:
--        Criterio 1: menor precio (columna price de supplier_prices)
--        Criterio 2: menor lead_time_days como desempate
--   3. Agrupar líneas por proveedor → crear un purchase_order por proveedor
--   4. Calcular qty_suggested = MAX(minimum_stock * 2 - stock_actual, 1)
--      (pide el doble del mínimo, garantizando stock de seguridad)
--
-- Idempotente: si ya existe un DRAFT para el mismo proveedor del mismo día,
-- lo reutiliza (ON CONFLICT en purchase_order_items).
-- Retorna el número de órdenes generadas como RAISE NOTICE.
-- 1. PARA CADA insumo donde stock_bodega <= minimum_stock Y minimum_stock > 0:
--    a. Buscar proveedor óptimo:
--       - Criterio 1: precio más bajo (supplier_prices.price ASC)
--       - Criterio 2: menor lead_time como desempate
--    b. Calcular cantidad sugerida:
--       qty = MAX( (minimum_stock × 2) - stock_actual, 1 )
--       → Pide el doble del mínimo (stock de seguridad 2x)
--    c. Agrupar por proveedor → un purchase_order DRAFT por proveedor por día
--    d. Idempotente: re-ejecutar actualiza en lugar de duplicar (ON CONFLICT)

-- 2. RESULTADO: purchase_orders con status DRAFT
--    → Admin revisa en panel → Confirma → PATCH /purchase-orders/:id/send → SENT

-- Genera un purchase_order DRAFT por proveedor para el día.
-- Idempotente: reutiliza el DRAFT del mismo proveedor si ya existe.
CREATE OR REPLACE PROCEDURE sp_generate_purchase_suggestions()
LANGUAGE plpgsql AS $$
DECLARE
    v_item            RECORD;
    v_best_supplier   RECORD;
    v_order_id        UUID;
    v_qty_suggested   DECIMAL(12,4);
    v_lines_created   INT := 0;
    v_loc_bodega_id   UUID;
BEGIN
    SELECT id INTO v_loc_bodega_id
    FROM inventory_locations WHERE code = 'LOC-BODEGA';

    IF v_loc_bodega_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación LOC-BODEGA no encontrada. Ejecutar seeds primero.';
    END IF;

    -- Iterar items con stock crítico
    FOR v_item IN
        SELECT
            ii.id            AS item_id,
            ii.code          AS item_code,
            ii.minimum_stock,
            COALESCE(sl.stock, 0) AS stock_bodega
        FROM inventory_items ii
        LEFT JOIN inventory_stock_locations sl
               ON sl.item_id = ii.id AND sl.location_id = v_loc_bodega_id
        WHERE ii.is_active = true
          AND COALESCE(sl.stock, 0) <= ii.minimum_stock
          AND ii.minimum_stock > 0
        ORDER BY ii.name
    LOOP
        -- Proveedor óptimo: menor precio, desempate por menor lead_time
        SELECT sp.supplier_id, sp.price, sp.lead_time_days
        INTO v_best_supplier
        FROM supplier_prices sp
        JOIN suppliers s ON s.id = sp.supplier_id
        WHERE sp.item_id = v_item.item_id AND s.is_active = true
        ORDER BY sp.price ASC, sp.lead_time_days ASC
        LIMIT 1;

        -- Sin proveedor vinculado: saltar este item
        IF v_best_supplier.supplier_id IS NULL THEN
            CONTINUE;
        END IF;

        v_qty_suggested := GREATEST(
            (v_item.minimum_stock * 2) - v_item.stock_bodega, 1
        );

        -- Reutilizar o crear el pedido DRAFT de este proveedor para hoy
        SELECT id INTO v_order_id
        FROM purchase_orders
        WHERE supplier_id = v_best_supplier.supplier_id
          AND status = 'DRAFT'
          AND DATE(generated_at) = CURRENT_DATE
        LIMIT 1;

        IF v_order_id IS NULL THEN
            INSERT INTO purchase_orders (supplier_id, status, total_amount)
            VALUES (v_best_supplier.supplier_id, 'DRAFT', 0)
            RETURNING id INTO v_order_id;
        END IF;

        -- Upsert de la línea
        INSERT INTO purchase_order_items (
            order_id, item_id, supplier_id, origin,
            qty_suggested, qty_delivered, unit_price, lead_time_days
        ) VALUES (
            v_order_id,
            v_item.item_id,
            v_best_supplier.supplier_id,
            'KITCHEN',
            v_qty_suggested,
            0,
            COALESCE(v_best_supplier.price, 0),
            COALESCE(v_best_supplier.lead_time_days, 1)
        )
        ON CONFLICT (order_id, item_id) DO UPDATE SET
            supplier_id    = EXCLUDED.supplier_id,
            qty_suggested  = EXCLUDED.qty_suggested,
            unit_price     = EXCLUDED.unit_price,
            lead_time_days = EXCLUDED.lead_time_days,
            origin         = EXCLUDED.origin;

        -- Recalcular total del pedido
        UPDATE purchase_orders
        SET total_amount = COALESCE(
                (SELECT SUM(qty_suggested * unit_price)
                 FROM purchase_order_items WHERE order_id = v_order_id), 0),
            updated_at = NOW()
        WHERE id = v_order_id;

        v_lines_created := v_lines_created + 1;
    END LOOP;

    RAISE NOTICE '% líneas de pedido generadas/actualizadas.', v_lines_created;
END;
$$;

COMMENT ON PROCEDURE sp_generate_purchase_suggestions IS
    'Genera o actualiza purchase_orders DRAFT, uno por proveedor óptimo por día. '
    'Cada línea lleva origin=KITCHEN. Idempotente: reutiliza el DRAFT del proveedor si ya existe.';


-- ════════════════════════════════════════════════════════════
-- B) sp_pos_submit_order ACTUALIZADO — routing con route_to_kds
-- ════════════════════════════════════════════════════════════
--
-- Cambio crítico respecto a la versión anterior:
--   ANTES: v_initial_status = PENDING_KITCHEN si has_recipe, sino PENDING_FLOOR
--   AHORA: v_initial_status = PENDING_KITCHEN si has_recipe AND route_to_kds
--          v_initial_status = PENDING_FLOOR   en cualquier otro caso
--
-- Esto permite que bebidas (route_to_kds=false en su categoría) nunca
-- aparezcan en el KDS aunque tengan receta (Ej: cocteles con BOM).
-- El mesero los recoge directamente de la barra.

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
    v_route_to_kds   BOOLEAN;   -- ← NUEVO
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

        -- ── JOIN con categoría para leer route_to_kds ───────
        SELECT md.id, md.price, md.has_recipe, mc.route_to_kds
        INTO   v_dish_id, v_dish_price, v_has_recipe, v_route_to_kds
        FROM   public.menu_dishes md
        JOIN   public.menu_categories mc ON mc.id = md.category_id
        WHERE  md.code = v_dish_code;

        IF v_dish_id IS NULL THEN
            RAISE EXCEPTION 'Platillo no encontrado: %', v_dish_code;
        END IF;

        v_total := v_total + (v_dish_price * v_qty);

        -- ── Decisión de routing ──────────────────────────────
        --  • KDS (PENDING_KITCHEN): tiene receta Y su categoría va a cocina
        --  • Piso (PENDING_FLOOR):  sin receta  O categoría con route_to_kds=false
        --                           (bebidas, postres de mostrador, etc.)
        v_initial_status := CASE
            WHEN v_has_recipe = true AND v_route_to_kds = true THEN 'PENDING_KITCHEN'
            ELSE 'PENDING_FLOOR'
        END;

        INSERT INTO public.order_items (
            order_id, dish_id, quantity, unit_price, subtotal, notes, status
        ) VALUES (
            v_order_id, v_dish_id, v_qty,
            v_dish_price, (v_dish_price * v_qty),
            v_notes, v_initial_status
        );
    END LOOP;

    UPDATE public.order_headers SET total = v_total WHERE id = v_order_id;
END;
$$;
