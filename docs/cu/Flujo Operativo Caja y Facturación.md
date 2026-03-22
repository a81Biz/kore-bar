### Flujo Operativo Actualizado: Caja, Permisos Dinámicos y Facturación

**FASE 0: Administración y Seguridad Dinámica (Back-Office)**

1. 🛡️ **Permisos de Rol:** En `admin.localhost`, al gestionar las Áreas/Puestos, se añade un control de acceso (Ej. un booleano `can_access_cashier`).
2. 👥 **Asignación:** El administrador activa este permiso para los puestos de "Cajero", "Gerente" o cualquiera que lo requiera en el futuro.

**FASE 1: Autenticación Segura (`cashier.localhost`)**
3. 💻 **Acceso:** El empleado entra a la terminal de caja.
4. 🔓 **Login Dinámico:** El sistema despliega una lista **exclusiva** de los empleados que pertenecen a áreas con el permiso `can_access_cashier = true`. El empleado selecciona su nombre e ingresa su PIN de 6 dígitos.

**FASE 2: El Pre-Cierre (El Mesero en `waiters.localhost`)**
5. ⏸️ **Congelamiento:** El mesero verifica que todo esté `DELIVERED`, imprime la pre-cuenta (ticket para el cliente) y la mesa pasa a estado `AWAITING_PAYMENT`. La sesión del QR se bloquea.

**FASE 3: Procesamiento (El Cajero en `cashier.localhost`)**
6. 📋 **Tablero de Cobro:** El cajero ve las mesas en espera de pago.
7. 💳 **Registro de Transacción:** Selecciona la mesa, ingresa el método de pago (soportando pagos divididos, ej. efectivo + tarjeta) y registra el monto exacto de la propina por separado.
8. 🧾 **Cierre de Mesa:** Confirma el cobro. El sistema destruye la sesión del código QR, emite el **Ticket Final** con un Folio Único y libera la mesa para que el POS la vea verde nuevamente.

**FASE 4: Facturación de Auto-Servicio (`invoice.localhost`)**
9. 🌐 **Portal del Cliente:** El cliente entra a la web de facturación impresa en su ticket.
10. 🔍 **Validación:** El formulario inicia pidiendo únicamente el **Código/Folio del Ticket**.
11. 🧾 **Timbrado:** Si el ticket existe y no ha sido facturado, le pide sus datos fiscales (RFC, Nombre, Uso CFDI) y genera el documento.

**FASE 5: El Corte de Caja (Fin de Turno)**
12. 📊 **Corte Z:** El cajero genera el reporte ciego de ventas totales, ingresos por método de pago y propinas a repartir, cruzando el dinero físico contra el sistema.
