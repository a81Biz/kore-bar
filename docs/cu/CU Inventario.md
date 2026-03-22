### Documento 1: Casos de Uso (`CU Inventario.md`)

# Casos de Uso: Micrositio de Administración (`admin.localhost`)

## 📦 Módulo: Gestión de Inventario y Proveedores

*Este módulo centraliza el registro de proveedores, el control de existencias teóricas y el historial financiero y de movimientos de cada insumo.*

* **CU-INV-01: Gestión del Catálogo de Proveedores.** * *Descripción:* El administrador da de alta a las entidades comerciales que surten al restaurante, asignando un código único, razón social y datos de contacto.
* *Restricción de Negocio:* No se capturan productos aquí, solo la información de la empresa proveedora.


* **CU-INV-02: Monitor de Existencias (Stock Actual).**
* *Descripción:* El sistema muestra una tabla en tiempo real con todos los insumos activos del sistema (creados previamente por el Chef), indicando su Stock Actual y el Costo Promedio (o último costo) al que fueron adquiridos.


* **CU-INV-03: Registro de Entradas (Compras / Recepción de Mercancía).**
* *Descripción:* Cuando llega un pedido, el administrador registra una "Entrada". Selecciona el insumo, el proveedor, la cantidad recibida y el costo unitario facturado.
* *Efecto:* El sistema suma la cantidad al `current_stock` del insumo, actualiza el `last_cost` y genera un registro inmutable en el Kardex.


* **CU-INV-04: Ajustes de Inventario (Mermas y Salidas Manuales).**
* *Descripción:* El administrador puede hacer correcciones al inventario por concepto de caducidad, merma, accidentes o robos.
* *Efecto:* El sistema resta la cantidad del `current_stock` y genera un registro en el Kardex justificando la salida con un comentario (Referencia).


* **CU-INV-05: Auditoría de Movimientos (Kardex).**
* *Descripción:* Un historial de transacciones de solo lectura donde el administrador puede auditar el ciclo de vida de los insumos. Muestra fecha, tipo de movimiento (ENTRADA, SALIDA, AJUSTE), cantidad afectada y la referencia.

* **CU-INV-06: Catálogo de Costos pactados (`supplier_prices`).**
* *Descripción:* El administrador asocia un Insumo a un Proveedor e ingresa a qué precio se lo dejan. Un tomate puede tener dos proveedores, pero uno es el principal.


* **CU-INV-07: Reporte de Sugerencia de Resurtido (El Handoff a Compras).**
* *Descripción:* Un endpoint que hace la magia matemática. Busca todos los insumos donde el `current_stock` es menor al `minimum_stock`.
* *Efecto:* Cruza la información con la tabla `supplier_prices` y escupe una lista limpia: *"Faltan 5 Kg de Tomate -> El proveedor más barato/rápido es 'Verduras San Juan' a $20/Kg"*. Esta tabla se puede exportar a Excel o imprimir para dársela a Compras.


