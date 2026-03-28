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

CREATE OR REPLACE PROCEDURE sp_generate_purchase_suggestions()
LANGUAGE plpgsql AS $$
DECLARE
    v_item            RECORD;
    v_best_supplier   RECORD;
    v_order_id        UUID;
    v_qty_suggested   DECIMAL(12,4);
    v_line_total      DECIMAL(12,2);
    v_orders_created  INT := 0;
    v_lines_created   INT := 0;
    v_loc_bodega_id   UUID;
    v_stock_bodega    DECIMAL(12,4);
BEGIN
    -- Resolvemos la ubicación bodega una sola vez
    SELECT id INTO v_loc_bodega_id
    FROM inventory_locations WHERE code = 'LOC-BODEGA';

    IF v_loc_bodega_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación LOC-BODEGA no encontrada. Ejecutar seeds primero.';
    END IF;

    -- ── Iterar sobre items con stock bajo ───────────────────
    FOR v_item IN
        SELECT
            ii.id            AS item_id,
            ii.code          AS item_code,
            ii.name          AS item_name,
            ii.minimum_stock,
            COALESCE(sl.stock, 0) AS stock_bodega
        FROM inventory_items ii
        LEFT JOIN inventory_stock_locations sl
               ON sl.item_id = ii.id
              AND sl.location_id = v_loc_bodega_id
        WHERE ii.is_active = true
          AND COALESCE(sl.stock, 0) <= ii.minimum_stock
          AND ii.minimum_stock > 0  -- ignorar items sin mínimo configurado
        ORDER BY ii.name
    LOOP
        -- ── Seleccionar proveedor óptimo para este item ─────
        --    Criterio: precio más bajo. Desempate: menor lead_time.
        SELECT
            sp.supplier_id,
            sp.price,
            sp.lead_time_days,
            s.code AS supplier_code
        INTO v_best_supplier
        FROM supplier_prices sp
        JOIN suppliers s ON s.id = sp.supplier_id
        WHERE sp.item_id = v_item.item_id
          AND s.is_active = true
        ORDER BY sp.price ASC, sp.lead_time_days ASC
        LIMIT 1;

        -- Si no hay proveedor vinculado, saltar el item
        IF v_best_supplier IS NULL THEN
            RAISE NOTICE 'Sin proveedor para item %: se omite de la sugerencia.', v_item.item_code;
            CONTINUE;
        END IF;

        -- ── Calcular cantidad sugerida ───────────────────────
        --    Target: reposición al doble del mínimo (stock de seguridad 2x)
        v_qty_suggested := GREATEST(
            (v_item.minimum_stock * 2) - v_item.stock_bodega,
            1
        );
        v_line_total := v_qty_suggested * v_best_supplier.price;

        -- ── Reutilizar o crear purchase_order del proveedor ──
        --    Un solo DRAFT por proveedor por día (idempotente).
        SELECT id INTO v_order_id
        FROM purchase_orders
        WHERE supplier_id = v_best_supplier.supplier_id
          AND status      = 'DRAFT'
          AND DATE(generated_at) = CURRENT_DATE
        LIMIT 1;

        IF v_order_id IS NULL THEN
            INSERT INTO purchase_orders (supplier_id, status, total_amount)
            VALUES (v_best_supplier.supplier_id, 'DRAFT', 0)
            RETURNING id INTO v_order_id;

            v_orders_created := v_orders_created + 1;
        END IF;

        -- ── Insertar línea (idempotente: actualiza si ya existe) ──
        INSERT INTO purchase_order_items (
            order_id, item_id, qty_suggested, unit_price, lead_time_days
        ) VALUES (
            v_order_id,
            v_item.item_id,
            v_qty_suggested,
            v_best_supplier.price,
            v_best_supplier.lead_time_days
        )
        ON CONFLICT (order_id, item_id)
        DO UPDATE SET
            qty_suggested  = EXCLUDED.qty_suggested,
            unit_price     = EXCLUDED.unit_price,
            lead_time_days = EXCLUDED.lead_time_days;

        -- ── Actualizar total de la orden cabecera ────────────
        UPDATE purchase_orders
        SET total_amount = (
            SELECT COALESCE(SUM(qty_suggested * unit_price), 0)
            FROM purchase_order_items WHERE order_id = v_order_id
        ),
        updated_at = NOW()
        WHERE id = v_order_id;

        v_lines_created := v_lines_created + 1;
    END LOOP;

    RAISE NOTICE 'Sugerencias generadas: % órdenes, % líneas.', v_orders_created, v_lines_created;
END;
$$;

COMMENT ON PROCEDURE sp_generate_purchase_suggestions IS
    'Genera purchase_orders DRAFT automáticamente para items con stock <= minimum_stock. '
    'Algoritmo de selección: precio mínimo primero, lead_time como desempate. '
    'Idempotente: re-ejecutar el mismo día actualiza en lugar de duplicar.';


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
