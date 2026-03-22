# Índice de Casos de Uso — Kore Bar OS
**Evidencia HU-03 · Diagrama de Casos de Uso · Sprint 1 · Marzo 2026**

> Este documento consolida, agrupa y audita todos los casos de uso
> del sistema. Sirve como referencia única para la validación de
> cobertura funcional y como evidencia de la Historia de Usuario HU-03.
>
> **Estado del documento:** Revisión inicial — incluye diagnóstico de
> huecos y solapamientos detectados durante la auditoría.

---

## Actores del Sistema

| ID | Actor | Tipo | Micrositio |
|---|---|---|---|
| A-01 | **Administrador / Gerente** | Primario interno | `admin.localhost` |
| A-02 | **Mesero / Capitán / Runner** | Primario interno | `waiters.localhost` |
| A-03 | **Chef / Cocinero** | Primario interno | `kitchen.localhost` |
| A-04 | **Cajero** | Primario interno | `cashier.localhost` |
| A-05 | **Comensal** | Primario externo | `menu.localhost` |
| A-06 | **Sistema de RRHH (HR)** | Secundario externo | API / Webhook |
| A-07 | **API SAT / PAC** | Secundario externo | `invoice.localhost` |

---

## Índice Agrupado por Módulo

### 📋 MÓDULO 1 — Gestión de Piso
*Actor principal: A-01 (Administrador)*
*Fuente: `CU Gestión de Piso.md`*

#### Grupo Z — Zonas (Áreas Físicas)

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-Z01 | Crear Zona nueva (ej. `TERR`, `Terraza VIP`) | Éxito | ✅ Documentado |
| CU-Z02 | Intentar crear Zona con código duplicado | Error — Unicidad | ✅ Documentado |
| CU-Z03 | Modificar nombre descriptivo de Zona existente | Éxito | ✅ Documentado |
| CU-Z04 | Borrar Zona sin mesas → Hard Delete | Éxito limpio | ✅ Documentado |
| CU-Z05 | Borrar Zona con historial → Soft Delete (`is_active=false`) | Soft Delete | ✅ Documentado |
| CU-Z06 | Intentar borrar Zona con mesas activas → bloqueado | Error protegido | ✅ Documentado |

#### Grupo M — Mesas

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-M01 | Crear Mesa asignada a Zona (`T-01`, capacity: 4) | Éxito | ✅ Documentado |
| CU-M02 | Crear Mesa con ZoneCode inactivo o inexistente | Error | ✅ Documentado |
| CU-M03 | Editar capacidad o reubicar Mesa a otra Zona | Éxito | ✅ Documentado |
| CU-M04 | Borrar Mesa sin comandas → Hard Delete | Éxito limpio | ✅ Documentado |
| CU-M05 | Borrar Mesa con ventas históricas → Soft Delete | Soft Delete | ✅ Documentado |

#### Grupo A — Asignaciones Operativas

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-A01 | Asignar empleado activo a Zona para fecha y turno | Éxito | ✅ Documentado |
| CU-A02 | Anti-colisión: mismo empleado en dos zonas mismo turno | Error | ✅ Documentado |
| CU-A03 | Reasignar empleado (moverlo de zona en mismo turno) | Éxito | ✅ Documentado |
| CU-A04 | Eliminar asignación futura → Hard Delete | Éxito | ✅ Documentado |
| **CU-A05** | **Asignación recurrente por Semana o Mes (bloque)** | Extensión | ⚠️ **FALTANTE** — existe la regla R-TIME-02 y el frontend pero no hay CU formal |
| **CU-A06** | **Intentar crear bloque recurrente con colisión parcial → Todo o Nada** | Error | ⚠️ **FALTANTE** — regla R-COL-03 documentada sin CU formal |

---

### 👥 MÓDULO 2 — Gestión de Empleados y RRHH
*Actor principal: A-01 (Administrador), A-06 (Sistema HR)*
*Fuente: `admin-empleados.md`, flujos operativos*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| **CU-HR-01** | **Sincronizar plantilla desde archivo JSON de RRHH (PULL)** | Éxito | ⚠️ **FALTANTE** — solo documentado como flujo MDM, no como CU |
| **CU-HR-02** | **Reconciliar empleado nuevo (CREATE) desde HR** | MDM | ⚠️ **FALTANTE** — escenario EMP-01 sin CU formal |
| **CU-HR-03** | **Reconciliar reingreso válido (REACTIVATE)** | MDM | ⚠️ **FALTANTE** — escenario EMP-03 sin CU formal |
| **CU-HR-04** | **Rechazar reingreso inválido (fecha HR más antigua que BD)** | MDM error | ⚠️ **FALTANTE** — escenario EMP-04 sin CU formal |
| **CU-HR-05** | **Marcar empleado como Huérfano (activo en BD, no en HR)** | MDM | ⚠️ **FALTANTE** — escenario NONE\|ACTIVO sin CU formal |
| **CU-HR-06** | **Editar empleado individual (Área, Puesto, Estado activo)** | Éxito | ⚠️ **FALTANTE** — implementado en UI-01 sin CU formal |
| **CU-HR-07** | **Guardar masivamente todos los empleados pendientes** | Éxito | ⚠️ **FALTANTE** — botón "Guardar Todos" sin CU formal |
| **CU-HR-08** | **Registrar Baja de empleado (Soft Delete vía HR o manual)** | Éxito | ⚠️ **FALTANTE** — implementado en SP sin CU formal |

---

### 🕐 MÓDULO 3 — Turnos y Asistencia
*Actor principal: A-01 (Administrador)*
*Fuente: `Módulo de Gestión de Turnos y Asistencia.md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| **CU-TRN-01** | **Crear Turno en el catálogo (Matutino, Vespertino)** | Éxito | ⚠️ **FALTANTE** |
| **CU-TRN-02** | **Visualizar Monitor en Vivo de asistencia del turno actual** | Consulta | ⚠️ **FALTANTE** |
| **CU-TRN-03** | **Consultar Historial de asistencia por empleado y rango de fechas** | Consulta | ⚠️ **FALTANTE** |
| **CU-TRN-04** | **Registrar Check-in automático al primer login del día** | Automático | ⚠️ **FALTANTE** — implementado en SP pero sin CU |
| **CU-TRN-05** | **Restablecer PIN de empleado (planchado)** | Seguridad | ⚠️ **FALTANTE** |

---

### 🍔 MÓDULO 4 — Gestión de Menú (Admin)
*Actor principal: A-01 (Administrador)*
*Fuente: `CU Gestión de Platillos.md`, `R-UI Gestión de Menú.md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-MENU-01 | Crear Categoría de menú (ej. `BEB`, Bebidas) | Éxito | ✅ Documentado |
| CU-MENU-02 | Intentar crear Categoría con código duplicado | Error | ✅ Implícito en R-COL-MENU-01 |
| CU-MENU-03 | Eliminar Categoría sin platillos activos | Éxito | ✅ Implícito en SP smart |
| CU-MENU-04 | Intentar eliminar Categoría con platillos activos (P0001) | Error | ✅ Documentado en R-REL-MENU-01 |
| CU-MENU-05 | Dar de alta Platillo (cascarón comercial) | Éxito | ✅ Documentado |
| CU-MENU-06 | Intentar crear Platillo con código duplicado | Error | ✅ Documentado en R-COL-MENU-01 |
| CU-MENU-07 | Revisar Comercialmente un platillo terminado por Cocina | Éxito | ✅ Documentado como Candado Comercial |
| CU-MENU-08 | Reemplazar fotografía del platillo (WebP comprimido) | Éxito | ✅ Documentado |
| CU-MENU-09 | Eliminar Platillo (Hard/Soft según historial) | Éxito | ✅ Implícito en SP smart |
| **CU-MENU-10** | **Activar / Desactivar Platillo sin eliminarlo** | Éxito | ⚠️ **FALTANTE** — `rev-active` existe en UI sin CU formal |

---

### 👨‍🍳 MÓDULO 5 — Ingeniería de Menú (Cocina)
*Actor principal: A-03 (Chef / Cocinero)*
*Fuente: `CU Cocina.md`, `R-UI Ingeniería de Menú (Cocina).md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-COC-01 | Ver Bandeja de Platillos Pendientes de Receta | Consulta | ✅ Documentado |
| CU-COC-02 | Buscar insumo existente en catálogo | Consulta | ✅ Documentado |
| CU-COC-03 | Dar de alta insumo nuevo (nombre + unidad) | Éxito | ✅ Documentado |
| CU-COC-04 | Construir Receta Base / BOM del platillo | Éxito | ✅ Documentado |
| CU-COC-05 | Actualizar cantidad de insumo en receta (Upsert visual) | Éxito | ✅ Documentado en R-COL-REC-01 |
| CU-COC-06 | Cargar foto de emplatado de referencia | Éxito | ✅ Documentado |
| CU-COC-07 | Marcar Platillo como Terminado → Hand-off a Gerencia | Éxito | ✅ Documentado |
| CU-COC-08 | Intentar terminar platillo con receta vacía → bloqueado | Error | ✅ Documentado en R-REL-REC-01 |

---

### 🍳 MÓDULO 6 — KDS (Pizarra de Cocina en Tiempo Real)
*Actor principal: A-03 (Chef / Cocinero)*
*Fuente: `CU Cocina.md`, `Micrositio_Cocina.md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-COC-09 | Recibir comandas en tiempo real (WebSocket) | Automático | ✅ Documentado como CU-COC-06 original |
| CU-COC-10 | Visualizar detalle de comanda (Modal con notas y alergias) | Consulta | ✅ Documentado |
| CU-COC-11 | Avanzar platillo a "En Preparación" (inicia cronómetro) | Éxito | ✅ Documentado |
| CU-COC-12 | Marcar Platillo como Listo → notificación al mesero | Éxito | ✅ Documentado como CU-COC-07 original |
| **CU-COC-13** | **Login de Cocinero con PIN + Check-in automático** | Seguridad | ⚠️ **FALTANTE** — implementado (K01) sin CU formal |
| **CU-COC-14** | **Fin de Turno en Cocina (bloquea nuevas comandas)** | Operativo | ⚠️ **FALTANTE** — mencionado en flujo operativo sin CU |

---

### 📦 MÓDULO 7 — Inventario y Proveedores (Admin)
*Actor principal: A-01 (Administrador)*
*Fuente: `CU Inventario.md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-INV-01 | Dar de alta Proveedor con datos de contacto | Éxito | ✅ Documentado |
| CU-INV-02 | Intentar crear Proveedor con código duplicado | Error | ✅ Documentado en R-COL-INV-01 |
| CU-INV-03 | Vincular Insumo a Proveedor con precio pactado | Éxito | ✅ Documentado |
| CU-INV-04 | Autocompletar Insumo existente al escribir código (buscador híbrido) | UX | ✅ Documentado en R-UI-INV |
| CU-INV-05 | Ver Monitor de Existencias (Stock Actual por ubicación) | Consulta | ✅ Documentado como CU-INV-02 |
| CU-INV-06 | Sincronizar Compras (PULL de JSON de compra inicial) | Éxito | ✅ Documentado como CU-INV-03 |
| CU-INV-07 | Registrar Ajuste Físico (merma, caducidad, sobrante) | Éxito | ✅ Documentado como CU-INV-04 |
| CU-INV-08 | Intentar ajuste que deje stock negativo → bloqueado | Error | ✅ Documentado en R-FIN-INV-02 |
| CU-INV-09 | Traspasar Insumo de Bodega a Cocina (partida doble) | Éxito | ✅ Documentado en flujo operativo |
| CU-INV-10 | Ver Kardex (historial inmutable de movimientos) | Consulta | ✅ Documentado como CU-INV-05 |
| CU-INV-11 | Generar Sugerencia de Resurtido (stock < mínimo) | Automático | ✅ Documentado como CU-INV-07 |
| **CU-INV-12** | **Ejecutar Cierre de Día — Deducción automática por BOM** | Automático batch | ⚠️ **FALTANTE** — documentado como CU-COC-08 en Cocina pero no desde perspectiva Admin |

---

### 📋 MÓDULO 8 — Inventario (Proceso de Consumo / Cocina)
*Actor principal: A-03 (Chef), A-01 (Admin)*
*Fuente: `CU Cocina.md` §Módulo 3*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| CU-COC-15 | Ver descontador automático de inventario teórico por ventas | Automático | ✅ Documentado como CU-COC-08 |
| CU-COC-16 | Realizar Conteo Físico Ciego al cierre de turno | Éxito | ✅ Documentado como CU-COC-09 |
| CU-COC-17 | Sistema calcula y registra Merma (Teórico vs Físico) | Automático | ✅ Documentado como CU-COC-09 |
| CU-COC-18 | Ver Reporte de Fugas en Dashboard Gerencial | Consulta | ✅ Documentado como CU-COC-10 |
| CU-COC-19 | Generar Lista de Súper (sugerencia de compras) | Automático | ✅ Documentado como CU-COC-11 |

---

### 📱 MÓDULO 9 — POS Meseros
*Actor principal: A-02 (Mesero)*
*Fuente: `modulo2_meseros.md`, flujos operativos*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| **CU-MES-01** | **Login con PIN numérico en terminal de meseros** | Seguridad | ⚠️ **FALTANTE** — implementado (W02) sin CU formal |
| **CU-MES-02** | **Check-in automático al primer login del día** | Automático | ⚠️ **FALTANTE** |
| **CU-MES-03** | **Ver mapa de mesas de la zona asignada (colores de estado)** | Consulta | ⚠️ **FALTANTE** — implementado (W03) sin CU formal |
| **CU-MES-04** | **Abrir Mesa e indicar número de comensales** | Éxito | ⚠️ **FALTANTE** — implementado sin CU formal |
| **CU-MES-05** | **Registrar Pedido con modificadores (notas, alergias, términos)** | Éxito | ⚠️ **FALTANTE** — implementado (W04) sin CU formal |
| **CU-MES-06** | **Sistema divide comanda: ruta Cocina vs ruta Piso automáticamente** | Automático | ⚠️ **FALTANTE** |
| **CU-MES-07** | **Ver alerta de escasez al pedir producto con stock ≤ 1 por comensal** | Alerta | ⚠️ **FALTANTE** |
| **CU-MES-08** | **Marcar producto de Piso como Recogido (descuenta LOC-PISO)** | Éxito | ⚠️ **FALTANTE** |
| **CU-MES-09** | **Recibir notificación Push: platillo listo en cocina** | Automático | ⚠️ **FALTANTE** |
| **CU-MES-10** | **Marcar platillo de Cocina como Recogido (descuenta LOC-COCINA)** | Éxito | ⚠️ **FALTANTE** |
| **CU-MES-11** | **Marcar platillo como Entregado** | Éxito | ⚠️ **FALTANTE** |
| **CU-MES-12** | **Pre-cerrar Mesa (genera ticket, mesa pasa a AWAITING_PAYMENT)** | Éxito | ⚠️ **FALTANTE** — implementado (W05) sin CU formal |
| **CU-MES-13** | **Intentar cobrar con ítems sin entregar → botón bloqueado** | Error | ⚠️ **FALTANTE** |

---

### 💳 MÓDULO 10 — Caja y Cobro
*Actor principal: A-04 (Cajero)*
*Fuente: `Flujo Operativo Caja y Facturación.md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| **CU-CAJ-01** | **Login de Cajero (solo empleados con `can_access_cashier=true`)** | Seguridad | ⚠️ **FALTANTE** |
| **CU-CAJ-02** | **Ver tablero de mesas en AWAITING_PAYMENT** | Consulta | ⚠️ **FALTANTE** |
| **CU-CAJ-03** | **Procesar pago simple (un método)** | Éxito | ⚠️ **FALTANTE** |
| **CU-CAJ-04** | **Procesar pago dividido (efectivo + tarjeta)** | Éxito | ⚠️ **FALTANTE** |
| **CU-CAJ-05** | **Registrar propina por separado del total** | Éxito | ⚠️ **FALTANTE** |
| **CU-CAJ-06** | **Emitir Ticket Final con Folio Único (TKT-YYYYMMDD-XXXX)** | Automático | ⚠️ **FALTANTE** |
| **CU-CAJ-07** | **Liberar mesa (vuelve a AVAILABLE tras el pago)** | Automático | ⚠️ **FALTANTE** |
| **CU-CAJ-08** | **Generar Corte Z (resumen ciego de ventas del día)** | Consulta | ⚠️ **FALTANTE** |
| **CU-CAJ-09** | **Intentar cobrar con monto insuficiente → bloqueado** | Error | ⚠️ **FALTANTE** |

---

### 🧾 MÓDULO 11 — Facturación CFDI
*Actor principal: A-05 (Comensal) en portal de auto-servicio, A-07 (API SAT)*
*Fuente: `Flujo Operativo Caja y Facturación.md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| **CU-FAC-01** | **Ingresar Folio de Ticket para solicitar factura** | Éxito | ⚠️ **FALTANTE** |
| **CU-FAC-02** | **Ingresar datos fiscales (RFC, CP, Régimen, Uso CFDI, correo)** | Éxito | ⚠️ **FALTANTE** |
| **CU-FAC-03** | **Timbrar CFDI 4.0 con API del PAC / SAT** | Integración | ⚠️ **FALTANTE** |
| **CU-FAC-04** | **Enviar XML + PDF al correo del cliente** | Éxito | ⚠️ **FALTANTE** |
| **CU-FAC-05** | **Intentar facturar un ticket ya facturado → bloqueado** | Error | ⚠️ **FALTANTE** |
| **CU-FAC-06** | **Intentar facturar con Folio inexistente → error 404** | Error | ⚠️ **FALTANTE** |

---

### 📱 MÓDULO 12 — Menú QR (Comensales)
*Actor principal: A-05 (Comensal)*
*Fuente: `modulo1_comensales.md`*

| ID | Caso de Uso | Tipo | Estado |
|---|---|---|---|
| **CU-QR-01** | **Escanear código QR de mesa y acceder al menú digital** | Éxito | ⚠️ **FALTANTE** |
| **CU-QR-02** | **Ver menú por categorías (solo lectura)** | Consulta | ⚠️ **FALTANTE** — W01 implementado sin CU formal |
| **CU-QR-03** | **Compartir enlace de sesión de mesa por WhatsApp** | Éxito | ⚠️ **FALTANTE** |
| **CU-QR-04** | **Intentar acceder a sesión de mesa ya cerrada → pantalla de sesión expirada** | Error | ⚠️ **FALTANTE** |
| **CU-QR-05** | **Llamar al mesero desde el menú (botón de asistencia)** | Éxito | ⚠️ **FALTANTE** |

---

## Referencia a Diagramas UML Relacionados

| Diagrama | Archivo | Actores cubiertos |
|---|---|---|
| Diagrama de Casos de Uso (Mermaid) | `docs/diagramas/diagramas.md` | A-01 a A-05, A-07 |
| Diagrama de Secuencia — Pedidos | `docs/diagramas/diagramas.md` | A-02, A-03 |
| Diagrama de Secuencia — Aprovisionamiento | `docs/diagramas/diagramas.md` | A-01, A-03 |
| Diagrama de Actividad — Proceso Cocina | `docs/diagramas/diagramas.md` | A-03 |
| Flujo Operativo POS completo | `docs/Flujo Operativo Definitivo POS, Enrutamiento y KDS.md` | A-01, A-02, A-03, A-04 |
| Flujo Caja y Facturación | `docs/Flujo Operativo Caja y Facturación.md` | A-04, A-05, A-07 |
