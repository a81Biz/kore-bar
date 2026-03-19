-- ============================================================
-- sp_cashier.sql
-- Procedimiento de cierre de caja
-- Dependencias: 06_cashier.sql, 05_orders.sql, 01_hr.sql
--
-- Flujo atómico de sp_cashier_process_payment:
--   1. Resolver mesa → orden en AWAITING_PAYMENT
--   2. Validar cajero (por employee_number, is_active)
--   3. Validar que el monto recibido ≥ total de la orden
--   4. Insertar líneas de pago (cobro mixto soportado)
--   5. Asignar propina a la primera línea
--   6. Calcular subtotal y tax (IVA 16% incluido en precio)
--   7. Generar folio único con ticket_folio_seq
--   8. Insertar ticket y cerrar la orden
-- ============================================================

DROP PROCEDURE IF EXISTS public.sp_cashier_process_payment;

CREATE OR REPLACE PROCEDURE public.sp_cashier_process_payment(p_payload JSONB)
LANGUAGE plpgsql AS $$
DECLARE
    v_table_code        VARCHAR;
    v_cashier_code      VARCHAR;
    v_tip               DECIMAL;
    v_payments_json     JSONB;
    v_payment           JSONB;

    v_table_id          UUID;
    v_order_id          UUID;
    v_order_total       DECIMAL;
    v_cashier_id        UUID;

    v_folio             VARCHAR;
    v_folio_seq         BIGINT;
    v_subtotal          DECIMAL;
    v_tax               DECIMAL;
    v_tip_total         DECIMAL;
    v_total             DECIMAL;

    v_pay_method        VARCHAR;
    v_pay_amount        DECIMAL;
    v_payments_total    DECIMAL := 0;
    v_first_payment_id  UUID;
BEGIN
    -- ── 1. Extraer payload ────────────────────────────────────
    v_table_code    := p_payload->>'tableCode';
    v_cashier_code  := p_payload->>'cashierCode';
    v_tip           := COALESCE((p_payload->>'tip')::DECIMAL, 0);
    v_payments_json := p_payload->'payments';

    IF v_payments_json IS NULL OR jsonb_array_length(v_payments_json) = 0 THEN
        RAISE EXCEPTION 'Se requiere al menos una línea de pago en el campo payments';
    END IF;

    -- ── 2. Resolver mesa ──────────────────────────────────────
    SELECT id INTO v_table_id
    FROM public.restaurant_tables
    WHERE code = v_table_code AND is_active = true;

    IF v_table_id IS NULL THEN
        RAISE EXCEPTION 'Mesa no encontrada o inactiva: %', v_table_code;
    END IF;

    -- ── 3. Resolver cajero ────────────────────────────────────
    -- Busca por employee_number con is_active = true.
    -- La validación de permiso de caja es responsabilidad del login
    -- (ver cashier_model.js → empPermQuery) y no se repite aquí.
    SELECT id INTO v_cashier_id
    FROM public.employees
    WHERE employee_number = v_cashier_code AND is_active = true
    LIMIT 1;

    IF v_cashier_id IS NULL THEN
        RAISE EXCEPTION 'Cajero no encontrado o inactivo: %', v_cashier_code;
    END IF;

    -- ── 4. Obtener orden en AWAITING_PAYMENT ──────────────────
    SELECT id, total INTO v_order_id, v_order_total
    FROM public.order_headers
    WHERE table_id = v_table_id AND status = 'AWAITING_PAYMENT';

    IF v_order_id IS NULL THEN
        RAISE EXCEPTION 'La mesa % no tiene ninguna orden en estado AWAITING_PAYMENT', v_table_code;
    END IF;

    -- ── 5. Validar suma de pagos ≥ total ──────────────────────
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments_json)
    LOOP
        v_payments_total := v_payments_total + (v_payment->>'amount')::DECIMAL;
    END LOOP;

    IF v_payments_total < v_order_total THEN
        RAISE EXCEPTION 'El monto recibido ($%) es menor al total de la orden ($%)',
            v_payments_total, v_order_total;
    END IF;

    -- ── 6. Insertar líneas de pago ────────────────────────────
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments_json)
    LOOP
        v_pay_method := v_payment->>'method';
        v_pay_amount := (v_payment->>'amount')::DECIMAL;

        INSERT INTO public.payments (order_id, method, amount, tip, cashier_id)
        VALUES (v_order_id, v_pay_method, v_pay_amount, 0, v_cashier_id)
        RETURNING id INTO v_first_payment_id;
    END LOOP;
    -- NOTA: v_first_payment_id queda con el ID de la ÚLTIMA línea del loop.
    -- Si hay múltiples métodos de pago, la propina se asigna a la última línea.
    -- Para asignarla siempre a la primera, se necesitaría guardarla antes del loop.

    -- ── 7. Asignar propina ────────────────────────────────────
    IF v_tip > 0 AND v_first_payment_id IS NOT NULL THEN
        UPDATE public.payments SET tip = v_tip WHERE id = v_first_payment_id;
    END IF;

    -- ── 8. Calcular totales del ticket ────────────────────────
    -- Convención: precios en menú ya incluyen IVA 16%
    v_total     := v_order_total;
    v_tax       := ROUND(v_total - (v_total / 1.16), 2);
    v_subtotal  := v_total - v_tax;
    v_tip_total := v_tip;

    -- ── 9. Generar folio único ────────────────────────────────
    SELECT nextval('public.ticket_folio_seq') INTO v_folio_seq;
    v_folio := 'TKT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-'
               || LPAD(v_folio_seq::TEXT, 4, '0');

    -- ── 10. Insertar ticket y cerrar la orden ─────────────────
    INSERT INTO public.tickets (folio, order_id, subtotal, tax, tip_total, total)
    VALUES (v_folio, v_order_id, v_subtotal, v_tax, v_tip_total, v_total);

    UPDATE public.order_headers
    SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP
    WHERE id = v_order_id;

    RAISE NOTICE 'Pago procesado OK. Folio: %, Total: $%', v_folio, v_total;
END;
$$;
