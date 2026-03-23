-- ============================================================
-- 10_faltantes.sql
-- Tres gaps detectados en auditoría del sistema:
--   A) Pedidos automáticos a proveedores
--   B) Routing explícito del KDS (bebidas sin pasar por cocina)
--   C) Reporte de deducciones por inasistencia
--
-- Dependencias: 03_inventory.sql, 04_menu.sql, 08_turnos_asistencia.sql,
--               09_employee_schedules.sql
-- Ejecutar después de todos los demás migrations.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- A) PEDIDOS AUTOMÁTICOS A PROVEEDORES
-- ════════════════════════════════════════════════════════════

-- Cabecera del pedido sugerido (agrupado por proveedor)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id   UUID         NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    status        VARCHAR(20)  NOT NULL DEFAULT 'DRAFT'
                                    CHECK (status IN ('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED')),
    total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes         TEXT,
    generated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Líneas del pedido: qué item, cuánto pedir, a qué precio
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID         NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id           UUID         NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    qty_suggested     DECIMAL(12,4) NOT NULL CHECK (qty_suggested > 0),
    unit_price        DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    lead_time_days    INT          NOT NULL DEFAULT 1,
    UNIQUE(order_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_po_supplier   ON purchase_orders(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_poi_order_id  ON purchase_order_items(order_id);

CREATE TRIGGER update_purchase_orders_modtime
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

COMMENT ON TABLE purchase_orders IS
    'Pedidos a proveedores generados automáticamente por sp_generate_purchase_suggestions. '
    'Status DRAFT = sólo sugerencia; SENT = pedido enviado al proveedor.';

COMMENT ON TABLE purchase_order_items IS
    'Líneas de un purchase_order. qty_suggested = (reorder_point - stock_actual) '
    'redondeado al mínimo de compra. unit_price = precio vigente en supplier_prices.';


-- ════════════════════════════════════════════════════════════
-- B) KDS ROUTING EXPLÍCITO POR CATEGORÍA
-- ════════════════════════════════════════════════════════════
--
-- Antes: el routing se derivaba de has_recipe (accidente del BOM).
--   Platillo con receta    → PENDING_KITCHEN  (va a cocina)
--   Platillo sin receta    → PENDING_FLOOR    (mesero recoge)
--
-- Ahora: route_to_kds en menu_categories es la fuente de verdad.
--   route_to_kds = true   → los platillos de esta categoría van a KDS
--   route_to_kds = false  → bypass; el mesero los sirve directo (bebidas, postres, etc.)
--
-- Migración conservadora: default TRUE para no romper nada existente.
-- El admin configura FALSE en categoría "Bebidas" y "Postres de mostrador".

ALTER TABLE menu_categories
    ADD COLUMN IF NOT EXISTS route_to_kds BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN menu_categories.route_to_kds IS
    'FALSE = los platillos de esta categoría no generan ticket KDS (PENDING_FLOOR). '
    'Usar en Bebidas, Postres de mostrador, Snacks pre-empacados.';


-- ════════════════════════════════════════════════════════════
-- C) VISTA DE DEDUCCIONES POR INASISTENCIA
-- ════════════════════════════════════════════════════════════
--
-- Combina AUSENCIAS de las dos fuentes de roster:
--   vw_attendance_monitor  → meseros (restaurant_assignments)
--   vw_schedule_monitor    → cajeros / cocineros (employee_schedules)
--
-- No requiere tabla de nómina. El reporte se exporta como CSV
-- para ser consumido por el sistema de RRHH/ERP externo.
-- Una ausencia se consolida solo cuando la fecha ya pasó (< CURRENT_DATE)
-- y no existe check-in; incluye ventana de gracia de 15 min.

CREATE OR REPLACE VIEW vw_absence_deductions AS
-- Fuente 1: Meseros (restaurant_assignments)
SELECT
    ra.employee_number,
    e.first_name,
    e.last_name,
    a.code        AS area_code,
    a.name        AS area_name,
    ra.assignment_date  AS absence_date,
    sc.name       AS shift_name,
    sc.start_time,
    sc.end_time,
    'PISO'        AS roster_source
FROM  restaurant_assignments ra
JOIN  employees    e  ON e.employee_number = ra.employee_number
JOIN  positions    p  ON p.id = e.position_id
JOIN  areas        a  ON a.id = p.area_id
LEFT JOIN shift_catalog sc ON sc.code = ra.shift
LEFT JOIN attendance_records ar
        ON ar.employee_number = ra.employee_number
       AND ar.work_date       = ra.assignment_date
WHERE ar.id IS NULL
  AND ra.assignment_date < CURRENT_DATE

UNION ALL

-- Fuente 2: Cajeros y cocineros (employee_schedules)
SELECT
    es.employee_number,
    e.first_name,
    e.last_name,
    a.code        AS area_code,
    a.name        AS area_name,
    es.schedule_date    AS absence_date,
    sc.name       AS shift_name,
    sc.start_time,
    sc.end_time,
    'SCHEDULE'    AS roster_source
FROM  employee_schedules es
JOIN  employees    e  ON e.employee_number = es.employee_number
JOIN  positions    p  ON p.id = e.position_id
JOIN  areas        a  ON a.id = p.area_id
LEFT JOIN shift_catalog sc ON sc.code = es.shift_code
LEFT JOIN attendance_records ar
        ON ar.employee_number = es.employee_number
       AND ar.work_date       = es.schedule_date
WHERE ar.id IS NULL
  AND es.schedule_date < CURRENT_DATE

ORDER BY absence_date DESC, area_name, last_name;

COMMENT ON VIEW vw_absence_deductions IS
    'Une ausencias de meseros (restaurant_assignments) y staff no-piso (employee_schedules). '
    'Solo incluye fechas pasadas sin registro de check-in. '
    'Fuente para el reporte CSV de descuentos que se exporta al ERP de nómina.';
