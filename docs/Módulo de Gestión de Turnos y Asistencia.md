### Módulo de Gestión de Turnos y Asistencia (Admin Back-Office)

**Objetivo del Módulo:**
Centralizar la planeación operativa del restaurante (asignación de zonas y horarios), registrar la asistencia real del personal mediante su interacción con los puntos de venta/KDS, y proveer herramientas rápidas de seguridad (Gestión de PIN).

#### 1. Catálogo y Planeación de Turnos (El Esqueleto)
* **Definición de Turnos:** Capacidad de crear turnos estándar (Ej. "Matutino 08:00 - 16:00", "Vespertino 16:00 - 00:00").
* **Asignación Dinámica (Roster):** Un panel donde el Gerente asigna semanal o diariamente qué empleados trabajan en qué turno y, muy importante, **en qué zona** (Ej. "Juan Pérez -> Vespertino -> Terraza").
* *Nota Arquitectónica:* Esta asignación es la que alimenta los *dropdowns* dinámicos de `waiters.localhost` y `cashier.localhost`. Si no estás asignado al turno actual, no apareces en la pantalla para loguearte.

#### 2. Control de Asistencia Descentralizado (El Checador Operativo)
El sistema registrará automáticamente la hora exacta de entrada (Check-in) la primera vez que un empleado interactúe con su módulo correspondiente en el día:
* **Meseros:** Hacen *Check-in* al ingresar su PIN en `waiters.localhost` para abrir su mapa de mesas.
* **Cajeros/Gerentes:** Hacen *Check-in* al ingresar su PIN en `cashier.localhost` para ver el tablero de cobro.
* **Cocineros/Chefs:** Hacen *Check-in* al ingresar su PIN en `kitchen.localhost` para desbloquear el tablero Kanban (KDS) al inicio de su jornada.

#### 3. Monitor de Asistencia y Reportes (La Vista del Gerente)
* **Monitor en Tiempo Real:** Un *dashboard* visual en Admin que muestra el estado actual del turno (Ej. "Esperábamos a 5 personas. 4 ya hicieron Check-in, 1 está retrasado").
* **Historial Semanal/Mensual:** Una tabla de reportes filtrable por empleado o por fecha, mostrando la hora exacta de entrada registrada por el sistema, para calcular nóminas o retardos.

#### 4. Gestión de Seguridad (Reset de PIN)
* **Modal de "Planchado" de PIN:** Dentro de la vista del empleado o en el monitor de asistencia, un botón rápido de acción (`Reset PIN`).
* **Regla de Negocio:** No hay recuperación por correo ni SMS. El Gerente abre el modal, el empleado teclea su nuevo PIN de 6 dígitos en la pantalla, el Gerente confirma con su propia contraseña (o PIN maestro), y el PIN viejo se sobrescribe (se plancha) instantáneamente en la base de datos.

---