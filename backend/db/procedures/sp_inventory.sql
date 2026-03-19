-- ============================================================
-- sp_inventory.sql
-- Procedimientos almacenados del módulo de Inventario
-- Dependencias: 03_inventory.sql
-- ============================================================

-- ── TRASPASO ──────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE public.sp_kardex_transfer(
    p_item_code          VARCHAR,
    p_from_location_code VARCHAR,
    p_to_location_code   VARCHAR,
    p_base_qty           DECIMAL,
    p_user_id            UUID,
    p_reference_id       VARCHAR
)
LANGUAGE plpgsql AS $$
DECLARE
    v_item_id      UUID;
    v_from_loc_id  UUID;
    v_to_loc_id    UUID;
    v_conv_factor  DECIMAL;
    v_target_qty   DECIMAL;
BEGIN
    SELECT id, conversion_factor INTO v_item_id, v_conv_factor
    FROM public.inventory_items WHERE code = p_item_code;
    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'Insumo no encontrado: %', p_item_code;
    END IF;

    SELECT id INTO v_from_loc_id FROM public.inventory_locations WHERE code = p_from_location_code;
    IF v_from_loc_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación origen no encontrada: %', p_from_location_code;
    END IF;

    SELECT id INTO v_to_loc_id FROM public.inventory_locations WHERE code = p_to_location_code;
    IF v_to_loc_id IS NULL THEN
        RAISE EXCEPTION 'Ubicación destino no encontrada: %', p_to_location_code;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.inventory_stock_locations
        WHERE item_id = v_item_id AND location_id = v_from_loc_id AND stock >= p_base_qty
    ) THEN
        RAISE EXCEPTION 'Stock insuficiente en ubicación origen para: %', p_item_code;
    END IF;

    v_target_qty := p_base_qty * v_conv_factor;

    UPDATE public.inventory_stock_locations
    SET stock = stock - p_base_qty
    WHERE item_id = v_item_id AND location_id = v_from_loc_id;

    INSERT INTO public.inventory_stock_locations (item_id, location_id, stock)
    VALUES (v_item_id, v_to_loc_id, v_target_qty)
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET stock = inventory_stock_locations.stock + EXCLUDED.stock;

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
CREATE OR REPLACE PROCEDURE public.sp_sync_purchases(p_payload JSONB)
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
BEGIN
    v_supplier_code    := p_payload->'supplier'->>'code';
    v_supplier_name    := p_payload->'supplier'->>'name';
    v_supplier_contact := p_payload->'supplier'->>'contact';
    v_doc_reference    := p_payload->>'referenceId';
    v_destination_code := p_payload->>'destinationLocationCode';

    IF v_supplier_code IS NULL OR v_destination_code IS NULL THEN
        RAISE EXCEPTION 'Payload inválido: falta código de proveedor o ubicación destino';
    END IF;

    SELECT id INTO v_loc_bodega_id FROM inventory_locations WHERE code = v_destination_code;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ubicación destino no encontrada: %', v_destination_code;
    END IF;

    INSERT INTO suppliers (code, name, contact_info)
    VALUES (v_supplier_code, v_supplier_name, v_supplier_contact)
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name, contact_info = EXCLUDED.contact_info, updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_supplier_id;

    IF v_supplier_id IS NULL THEN
        SELECT id INTO v_supplier_id FROM suppliers WHERE code = v_supplier_code;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
        INSERT INTO inventory_items (
            code, name, unit_measure, recipe_unit, conversion_factor, minimum_stock
        ) VALUES (
            v_item.value->>'itemCode',
            v_item.value->>'itemName',
            v_item.value->>'purchaseUnit',
            v_item.value->>'recipeUnit',
            (v_item.value->>'conversionFactor')::DECIMAL,
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
            SELECT id INTO v_new_item_id FROM inventory_items WHERE code = v_item.value->>'itemCode';
        END IF;

        INSERT INTO supplier_prices (supplier_id, item_id, price)
        VALUES (v_supplier_id, v_new_item_id, (v_item.value->>'unitCost')::DECIMAL)
        ON CONFLICT (supplier_id, item_id) DO UPDATE
        SET price = EXCLUDED.price, updated_at = CURRENT_TIMESTAMP;

        INSERT INTO inventory_kardex (
            item_id, transaction_type, quantity, reference_id, to_location_id
        ) VALUES (
            v_new_item_id,
            'IN_PURCHASE',
            (v_item.value->>'quantityPurchased')::DECIMAL,
            COALESCE(v_doc_reference, 'SYNC-AUTO'),
            v_loc_bodega_id
        );

        INSERT INTO inventory_stock_locations (item_id, location_id, stock)
        VALUES (v_new_item_id, v_loc_bodega_id, (v_item.value->>'quantityPurchased')::DECIMAL)
        ON CONFLICT (item_id, location_id) DO UPDATE
        SET stock = inventory_stock_locations.stock + EXCLUDED.stock;
    END LOOP;
END;
$$;


-- ── UPSERT PRECIO PROVEEDOR ───────────────────────────────────
CREATE OR REPLACE PROCEDURE public.sp_upsert_supplier_price(
    p_supplier_code VARCHAR,
    p_item_code     VARCHAR,
    p_item_name     VARCHAR,
    p_item_unit     VARCHAR,
    p_price         NUMERIC
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

    INSERT INTO inventory_items (code, name, unit_measure)
    VALUES (p_item_code, p_item_name, p_item_unit)
    ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name, unit_measure = EXCLUDED.unit_measure
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
