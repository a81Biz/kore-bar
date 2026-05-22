-- ============================================================
-- sp_inventory.sql
-- Procedimientos almacenados del módulo de Inventario
-- Dependencias: 03_inventory.sql
-- ============================================================

-- ── TRASPASO ──────────────────────────────────────────────────
-- REGLA: Bodega y Cocina almacenan stock en recipeUnit (KG, PZ, LT…).
-- La conversión purchaseUnit→recipeUnit ocurre UNA SOLA VEZ al sincronizar
-- compras. El traspaso mueve recipeUnits directamente; no hay factor aquí.
CREATE OR REPLACE PROCEDURE public.sp_kardex_transfer(
    p_item_code          VARCHAR,
    p_from_location_code VARCHAR,
    p_to_location_code   VARCHAR,
    p_base_qty           DECIMAL,   -- cantidad en recipeUnit (KG, PZ…)
    p_user_id            UUID,
    p_reference_id       VARCHAR
)
LANGUAGE plpgsql AS $$
DECLARE
    v_item_id      UUID;
    v_from_loc_id  UUID;
    v_to_loc_id    UUID;
BEGIN
    -- Resolvemos IDs (ya no necesitamos conversion_factor aquí)
    SELECT id INTO v_item_id
    FROM public.inventory_items WHERE code = p_item_code;
    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'Insumo no encontrado: %', p_item_code;
    END IF;

    SELECT id INTO v_from_loc_id
    FROM public.inventory_locations WHERE code = p_from_location_code;
    IF v_from_loc_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación origen no encontrada: %', p_from_location_code;
    END IF;

    SELECT id INTO v_to_loc_id
    FROM public.inventory_locations WHERE code = p_to_location_code;
    IF v_to_loc_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación destino no encontrada: %', p_to_location_code;
    END IF;

    -- Validar stock suficiente en origen (en recipeUnit)
    IF NOT EXISTS (
        SELECT 1 FROM public.inventory_stock_locations
        WHERE item_id = v_item_id
          AND location_id = v_from_loc_id
          AND stock >= p_base_qty
    ) THEN
        RAISE EXCEPTION 'Stock insuficiente en % para: %', p_from_location_code, p_item_code;
    END IF;

    -- Restar de origen (recipeUnit)
    UPDATE public.inventory_stock_locations
    SET stock = stock - p_base_qty
    WHERE item_id = v_item_id AND location_id = v_from_loc_id;

    -- Sumar a destino (misma recipeUnit — sin multiplicar por conversionFactor)
    INSERT INTO public.inventory_stock_locations (item_id, location_id, stock)
    VALUES (v_item_id, v_to_loc_id, p_base_qty)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET stock = inventory_stock_locations.stock + EXCLUDED.stock;

    -- Registro en Kardex (cantidad trasladada en recipeUnit)
    INSERT INTO public.inventory_kardex (
        item_id, from_location_id, to_location_id,
        transaction_type, quantity, reference_id
    ) VALUES (
        v_item_id, v_from_loc_id, v_to_loc_id,
        'TRANSFER', p_base_qty,
        COALESCE(p_reference_id, 'TRANSFER-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS'))
    );
END;
$$;


-- ── AJUSTE FÍSICO ─────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE public.sp_kardex_adjustment(
    p_location_code  VARCHAR(50),
    p_item_code      VARCHAR(50),
    p_physical_stock DECIMAL(18, 4),
    p_note           TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
    v_location_id   UUID;
    v_item_id       UUID;
    v_current_stock DECIMAL(18, 4) := 0;
    v_difference    DECIMAL(18, 4);
BEGIN
    SELECT id INTO v_location_id FROM inventory_locations WHERE code = p_location_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ubicación no encontrada: %', p_location_code;
    END IF;

    SELECT id INTO v_item_id FROM inventory_items WHERE code = p_item_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Insumo no encontrado: %', p_item_code;
    END IF;

    SELECT stock INTO v_current_stock
    FROM inventory_stock_locations
    WHERE item_id = v_item_id AND location_id = v_location_id
    FOR UPDATE;

    v_current_stock := COALESCE(v_current_stock, 0);
    v_difference    := p_physical_stock - v_current_stock;

    IF v_difference = 0 THEN
        RETURN;
    END IF;

    INSERT INTO inventory_kardex (
        item_id, transaction_type, quantity, reference_id,
        from_location_id, to_location_id
    ) VALUES (
        v_item_id,
        'ADJUSTMENT',
        v_difference,
        COALESCE(p_note, 'Toma Física / Cierre de Turno'),
        v_location_id,
        v_location_id
    );

    INSERT INTO inventory_stock_locations (item_id, location_id, stock)
    VALUES (v_item_id, v_location_id, p_physical_stock)
    ON CONFLICT (item_id, location_id) DO UPDATE SET stock = EXCLUDED.stock;
END;
$$;


-- ── SINCRONIZACIÓN DE COMPRAS ─────────────────────────────────
-- ── SINCRONIZACIÓN DE COMPRAS ─────────────────────────────────
-- FIX: La cantidad en Kardex y stock_locations se guarda en recipeUnit:
--      qty_recipe = quantityPurchased × conversionFactor
--
-- Ejemplo:
--   INS-SAL:      quantityPurchased=1,  conversionFactor=12  → 12 KG en Bodega
--   INS-COCA-COLA: quantityPurchased=5, conversionFactor=24  → 120 PZ en Bodega
-- p_order_id opcional: si se proporciona, cruza la entrega contra el pedido
-- y actualiza qty_delivered + status (PARTIAL / RECEIVED).
-- Elimina la versión anterior de un solo argumento para evitar ambigüedad de overload.
DROP PROCEDURE IF EXISTS public.sp_sync_purchases(jsonb);
CREATE OR REPLACE PROCEDURE public.sp_sync_purchases(
    p_payload  JSONB,
    p_order_id UUID DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_supplier_id      UUID;
    v_item             RECORD;
    v_new_item_id      UUID;
    v_loc_bodega_id    UUID;
    v_supplier_code    VARCHAR(50);
    v_supplier_name    VARCHAR(255);
    v_supplier_contact VARCHAR(255);
    v_doc_reference    VARCHAR(100);
    v_destination_code VARCHAR(50);
    v_conv_factor      DECIMAL(18, 6);
    v_qty_purchased    DECIMAL(18, 4);
    v_qty_recipe       DECIMAL(18, 4);
    -- Para actualización del pedido
    v_total_items      INT;
    v_received_items   INT;
    v_any_received     BOOLEAN;
    v_new_status       VARCHAR(20);
BEGIN
    v_supplier_code    := p_payload->'supplier'->>'code';
    v_supplier_name    := p_payload->'supplier'->>'name';
    v_supplier_contact := p_payload->'supplier'->>'contact';
    v_doc_reference    := p_payload->>'referenceId';
    v_destination_code := p_payload->>'destinationLocationCode';

    IF v_supplier_code IS NULL OR v_destination_code IS NULL THEN
        RAISE EXCEPTION 'Payload inválido: falta código de proveedor o ubicación destino';
    END IF;

    SELECT id INTO v_loc_bodega_id
    FROM inventory_locations WHERE code = v_destination_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ubicación destino no encontrada: %', v_destination_code;
    END IF;

    INSERT INTO suppliers (code, name, contact_info)
    VALUES (v_supplier_code, v_supplier_name, v_supplier_contact)
    ON CONFLICT (code) DO UPDATE
        SET name = EXCLUDED.name,
            contact_info = EXCLUDED.contact_info,
            updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_supplier_id;

    IF v_supplier_id IS NULL THEN
        SELECT id INTO v_supplier_id FROM suppliers WHERE code = v_supplier_code;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
        -- Calcular cantidad en recipeUnit
        v_qty_purchased := COALESCE((v_item.value->>'quantityPurchased')::DECIMAL, 0);
        v_conv_factor   := COALESCE((v_item.value->>'conversionFactor')::DECIMAL, 1);
        v_qty_recipe    := v_qty_purchased * v_conv_factor;

        -- Upsert del insumo
        INSERT INTO inventory_items (
            code, name, unit_measure, recipe_unit, conversion_factor, minimum_stock
        ) VALUES (
            v_item.value->>'itemCode',
            v_item.value->>'itemName',
            v_item.value->>'purchaseUnit',
            v_item.value->>'recipeUnit',
            v_conv_factor,
            10
        )
        ON CONFLICT (code) DO UPDATE SET
            name              = EXCLUDED.name,
            unit_measure      = EXCLUDED.unit_measure,
            recipe_unit       = EXCLUDED.recipe_unit,
            conversion_factor = EXCLUDED.conversion_factor,
            updated_at        = CURRENT_TIMESTAMP
        RETURNING id INTO v_new_item_id;

        IF v_new_item_id IS NULL THEN
            SELECT id INTO v_new_item_id
            FROM inventory_items WHERE code = v_item.value->>'itemCode';
        END IF;

        -- Precio proveedor
        INSERT INTO supplier_prices (supplier_id, item_id, price)
        VALUES (v_supplier_id, v_new_item_id, (v_item.value->>'unitCost')::DECIMAL)
        ON CONFLICT (supplier_id, item_id) DO UPDATE
            SET price = EXCLUDED.price, updated_at = CURRENT_TIMESTAMP;

        -- Kardex
        INSERT INTO inventory_kardex (
            item_id, transaction_type, quantity, reference_id, to_location_id
        ) VALUES (
            v_new_item_id, 'IN_PURCHASE', v_qty_recipe,
            COALESCE(v_doc_reference, 'SYNC-AUTO'), v_loc_bodega_id
        );

        -- Stock en Bodega
        INSERT INTO inventory_stock_locations (item_id, location_id, stock)
        VALUES (v_new_item_id, v_loc_bodega_id, v_qty_recipe)
        ON CONFLICT (item_id, location_id)
        DO UPDATE SET stock = inventory_stock_locations.stock + EXCLUDED.stock;

        -- Cruzar con pedido de compra si se vinculó uno
        IF p_order_id IS NOT NULL THEN
            UPDATE purchase_order_items
            SET qty_delivered = qty_delivered + v_qty_recipe
            WHERE order_id = p_order_id AND item_id = v_new_item_id;
        END IF;
    END LOOP;

    -- Actualizar estado del pedido según nivel de recepción
    IF p_order_id IS NOT NULL THEN
        SELECT
            COUNT(*),
            COUNT(*) FILTER (WHERE qty_delivered >= qty_suggested),
            BOOL_OR(qty_delivered > 0)
        INTO v_total_items, v_received_items, v_any_received
        FROM purchase_order_items WHERE order_id = p_order_id;

        IF v_received_items = v_total_items AND v_total_items > 0 THEN
            v_new_status := 'RECEIVED';
        ELSIF v_any_received THEN
            v_new_status := 'PARTIAL';
        END IF;

        IF v_new_status IS NOT NULL THEN
            UPDATE purchase_orders
            SET status = v_new_status, updated_at = NOW()
            WHERE id = p_order_id AND status NOT IN ('RECEIVED', 'CANCELLED');
        END IF;
    END IF;
END;
$$;


-- ── UPSERT PRECIO PROVEEDOR ───────────────────────────────────
DROP PROCEDURE IF EXISTS public.sp_upsert_supplier_price(VARCHAR,VARCHAR,VARCHAR,VARCHAR,NUMERIC);
DROP PROCEDURE IF EXISTS public.sp_upsert_supplier_price(VARCHAR,VARCHAR,VARCHAR,VARCHAR,NUMERIC,NUMERIC);
 
CREATE OR REPLACE PROCEDURE public.sp_upsert_supplier_price(
    p_supplier_code VARCHAR,
    p_item_code     VARCHAR,
    p_item_name     VARCHAR,
    p_item_unit     VARCHAR,
    p_price         NUMERIC,
    p_minimum_stock NUMERIC DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_supplier_id UUID;
    v_item_id     UUID;
BEGIN
    SELECT id INTO v_supplier_id FROM suppliers WHERE code = p_supplier_code;
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'Proveedor no encontrado: %', p_supplier_code;
    END IF;
 
    INSERT INTO inventory_items (code, name, unit_measure, minimum_stock)
    VALUES (
        p_item_code, p_item_name, p_item_unit,
        COALESCE(p_minimum_stock, 0)
    )
    ON CONFLICT (code) DO UPDATE SET
        name          = EXCLUDED.name,
        unit_measure  = EXCLUDED.unit_measure,
        minimum_stock = CASE
            WHEN p_minimum_stock IS NOT NULL THEN p_minimum_stock
            ELSE inventory_items.minimum_stock
        END
    RETURNING id INTO v_item_id;
 
    IF v_item_id IS NULL THEN
        SELECT id INTO v_item_id FROM inventory_items WHERE code = p_item_code;
    END IF;
 
    INSERT INTO supplier_prices (supplier_id, item_id, price)
    VALUES (v_supplier_id, v_item_id, p_price)
    ON CONFLICT (supplier_id, item_id) DO UPDATE
    SET price = EXCLUDED.price;
END;
$$;

-- ── ALTA DE PROVEEDOR ─────────────────────────────────────────
-- Reemplaza el INSERT raw que vivía en admin-inventory.model.js

CREATE OR REPLACE PROCEDURE public.sp_create_supplier(
    p_code         VARCHAR,
    p_name         VARCHAR,
    p_contact_info TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO suppliers (code, name, contact_info)
    VALUES (p_code, p_name, p_contact_info);
END;
$$;
