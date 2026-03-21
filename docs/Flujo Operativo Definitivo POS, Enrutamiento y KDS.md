### Flujo Operativo Definitivo: POS, Enrutamiento y KDS (Kitchen Display System)

**FASE 1: Abastecimiento (El Back-Office y las Zonas)**

1. **Transferencia a Piso:** El Administrador mueve mercancía desde la Bodega Principal (`LOC-BODEGA`).
* Los insumos crudos van a `LOC-COCINA`.
* Los productos terminados (refrescos, pan, cervezas) van a la nueva zona operativa: **`LOC-PISO`** (o Barra).


2. **Disponibilidad:** El sistema registra que estos productos de servicio directo tienen un stock físico en el piso listo para ser tomado por los meseros.

**FASE 2: Toma de Pedido y Enrutamiento Inteligente (POS)**
3. **Validación de Stock:** El mesero levanta la orden. Si pide un producto de servicio directo (Ej. Refresco), el POS verifica el stock en `LOC-PISO`.
4. **Alerta de Escasez:** Si la cantidad disponible de ese producto es igual o menor a 1 por comensal (Ej. Hay 3 refrescos y son 3 comensales), el POS muestra una alerta visual al mesero advirtiendo el bajo inventario.
5. **División de Comanda (Fire):** Al presionar "Enviar", el sistema divide la orden en dos rutas automáticamente:

* **Ruta Cocina:** Los platillos que requieren preparación (`has_recipe = true`) se envían al Tablero de la Cocina.
* **Ruta Piso:** Los productos directos (`has_recipe = false`) se quedan en la pantalla del mesero listos para recolección.

**FASE 3: Entregas de Servicio Directo (Mesero)**
6. **Recolección:** El mesero va al refrigerador o estación de piso, toma el refresco y marca el producto como **"Recogido"** en su POS. (En este momento exacto se descuenta del Kardex de `LOC-PISO`).
7. **Entrega:** El mesero lo lleva a la mesa y presiona **"Entregado"**.

**FASE 4: Operación de Cocina (El Tablero Kanban KDS)**
8. **Apilamiento:** Las comandas de cocina entran y se apilan en la columna "Pendiente".
9. **Lectura (Modal):** El Chef hace clic sobre una tarjeta. Se abre un Modal grande que muestra los comensales, los platillos exactos y las notas (términos de carne, alergias). El Chef cierra el Modal con un botón claro.
10. **Preparación y Tiempos:** El Chef presiona el botón **"Preparar"**. La tarjeta se mueve a la columna "En Preparación" y arranca un cronómetro visible. (El sistema cambiará el color de la tarjeta si excede el tiempo de preparación estándar).
11. **Terminado:** El Chef termina el plato, presiona el botón **"Listo"**. La tarjeta pasa al área de terminados y el sistema dispara la notificación al POS del mesero.

**FASE 5: Recolección de Cocina y Candado de Caja**
12. **Recolección:** El mesero recibe la alerta, va a la ventanilla de cocina, toma el platillo y en su POS se habilita y presiona el botón **"Recogido"**. (El sistema descuenta los insumos del Kardex de `LOC-COCINA`).
13. **Entrega:** Al poner el plato en la mesa, el mesero presiona **"Entregado"**.
14. **El Candado de Cobro:** El sistema evalúa la sesión de la mesa. El botón de "Generar Ticket / Cobrar" permanece **bloqueado** hasta que el 100% de los artículos de la comanda (tanto de piso como de cocina) tengan el estatus de "Entregado".

**FASE 6: Cierre Operativo y Auditoría**
15. **Fin de Turno (Cocina):** Al terminar el día, el Chef presiona el botón "Fin de Turno" en su pantalla. El sistema bloquea la entrada de nuevas comandas.
16. **Inventario Ciego:** La cocina y el piso realizan su conteo físico de lo que sobró en sus zonas.
17. **Cierre de Admin:** La administración recibe los conteos, el sistema cruza las salidas teóricas del día contra el conteo físico, registra las diferencias (mermas) en el Kardex y guarda el historial inmutable del día para proyecciones futuras.

