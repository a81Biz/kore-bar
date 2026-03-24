-- ============================================================
-- run_all.sql
-- Script maestro — ejecuta todo en orden correcto
-- Uso: psql -U postgres -d kore_bar -f run_all.sql
--
-- ORDEN DE EJECUCIÓN:
--   migrations/  → DDL (tablas, constraints, triggers)
--   procedures/  → Lógica de negocio (re-ejecutable en cualquier momento)
--   views/       → Vistas de consulta (re-ejecutable)
--   seeds/       → Datos iniciales (idempotente con ON CONFLICT DO NOTHING)
-- ============================================================

\echo '── [1/4] Migrations ──────────────────────────────────────'
\ir migrations/00_core.sql
\ir migrations/01_hr.sql
\ir migrations/02_restaurant.sql
\ir migrations/03_inventory.sql
\ir migrations/04_menu.sql
\ir migrations/05_orders.sql
\ir migrations/06_cashier.sql
\ir migrations/07_operations.sql
\ir migrations/08_turnos_asistencia.sql
\ir migrations/09_employee_schedules.sql
\ir migrations/10_faltantes.sql
\ir migrations/11_payroll.sql

\echo '── [2/4] Procedures ──────────────────────────────────────'
\ir procedures/sp_hr.sql
\ir procedures/sp_restaurant.sql
\ir procedures/sp_inventory.sql
\ir procedures/sp_menu.sql
\ir procedures/sp_orders.sql
\ir procedures/sp_cashier.sql
\ir procedures/sp_auth.sql
\ir procedures/sp_faltantes.sql

\echo '── [3/4] Views ───────────────────────────────────────────'
\ir views/views.sql

\echo '── [4/4] Seeds ───────────────────────────────────────────'
\ir seeds/seeds.sql

\echo '── Done ──────────────────────────────────────────────────'