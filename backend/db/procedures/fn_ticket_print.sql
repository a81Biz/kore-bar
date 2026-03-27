-- ============================================================
-- sp_get_ticket_print_data
-- Genera los datos formateados para impresión de ticket 80mm
-- Recibe: folio del ticket (llave natural TKT-YYYYMMDD-XXXX)
-- Devuelve: JSON con header, items, totales y pie de ticket
-- ============================================================

CREATE OR REPLACE FUNCTION fn_get_ticket_print_data(
    p_folio VARCHAR
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket  RECORD;
    v_items   JSON;
    v_result  JSON;
BEGIN
    -- Buscar el ticket por folio (llave natural)
    SELECT
        t.folio,
        t.created_at,
        t.subtotal,
        t.tax,
        t.total,
        t.tip,
        t.payment_method,
        t.is_invoiced,
        oh.code           AS order_code,
        rt.code           AS table_code,
        rz.name           AS zone_name,
        CONCAT(e.first_name, ' ', e.last_name) AS waiter_name,
        e.employee_number AS waiter_number
    INTO v_ticket
    FROM tickets t
    JOIN order_headers oh  ON t.order_id    = oh.id
    LEFT JOIN restaurant_tables rt ON oh.table_id = rt.id
    LEFT JOIN restaurant_zones rz  ON rt.zone_id  = rz.id
    LEFT JOIN employees e          ON oh.waiter_id = e.id
    WHERE t.folio = p_folio;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ticket con folio % no encontrado', p_folio
            USING ERRCODE = 'P0002';
    END IF;

    -- Obtener los items del ticket
    SELECT json_agg(json_build_object(
        'dish_name',  md.name,
        'quantity',   oi.quantity,
        'unit_price', oi.unit_price,
        'line_total', (oi.quantity * oi.unit_price)
    ) ORDER BY oi.created_at)
    INTO v_items
    FROM order_items oi
    JOIN order_headers oh ON oi.order_id = oh.id
    JOIN tickets t        ON t.order_id  = oh.id
    JOIN menu_dishes md   ON oi.dish_id  = md.id
    WHERE t.folio = p_folio
      AND oi.status != 'CANCELLED';

    -- Armar el JSON de respuesta
    v_result := json_build_object(
        'header', json_build_object(
            'business_name', 'Kore Bar',
            'rfc',           'XAXX010101000',
            'address',       'Dirección del Restaurante',
            'folio',         v_ticket.folio,
            'date',          to_char(v_ticket.created_at, 'DD/MM/YYYY HH24:MI'),
            'order_code',    v_ticket.order_code,
            'table_code',    v_ticket.table_code,
            'zone_name',     v_ticket.zone_name,
            'waiter_name',   v_ticket.waiter_name
        ),
        'items', COALESCE(v_items, '[]'::json),
        'totals', json_build_object(
            'subtotal',       v_ticket.subtotal,
            'tax',            v_ticket.tax,
            'tip',            v_ticket.tip,
            'total',          v_ticket.total,
            'payment_method', v_ticket.payment_method
        ),
        'footer', json_build_object(
            'is_invoiced', v_ticket.is_invoiced,
            'message',     '¡Gracias por su visita!'
        )
    );

    RETURN v_result;
END;
$$;
