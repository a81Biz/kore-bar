-- ============================================================
-- 13_daily_consumption_view.sql
-- Vista: Consumo teórico diario calculado a partir de platillos
-- elaborados (DELIVERED) × recetas (BOM)
--
-- Requisito: "Al final de cada día, el jefe de cocina ejecuta
-- un proceso que calcula a partir de los platillos elaborados
-- los alimentos que se han consumido."
-- ============================================================

CREATE OR REPLACE VIEW vw_daily_theoretical_consumption AS
SELECT
    dr.item_id,
    ii.code                                    AS item_code,
    ii.name                                    AS item_name,
    ii.unit_measure,
    SUM(oi.quantity * dr.quantity_required)     AS theoretical_qty
FROM order_items   oi
JOIN order_headers oh  ON oh.id    = oi.order_id
JOIN dish_recipes  dr  ON dr.dish_id = oi.dish_id
JOIN inventory_items ii ON ii.id   = dr.item_id
WHERE DATE(oh.created_at) = CURRENT_DATE
  AND oi.status IN ('DELIVERED', 'COLLECTED', 'READY', 'PREPARING')
GROUP BY dr.item_id, ii.code, ii.name, ii.unit_measure;

-- Verificación:
-- SELECT * FROM vw_daily_theoretical_consumption;
-- Debe mostrar cada insumo con la cantidad teórica consumida hoy.