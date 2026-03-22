Grupo 1: Gestión de Zonas (Áreas Físicas)
CU-Z01 (Creación - Éxito): Crear una Zona nueva (ej. ZoneCode: "TERR", Name: "Terraza").

CU-Z02 (Creación - Error): Intentar crear una Zona con un código que ya existe (Violación de Unicidad).

CU-Z03 (Edición - Éxito): Modificar el nombre descriptivo de una Zona existente.

CU-Z04 (Borrado Híbrido - Éxito Limpio): Borrar una Zona recién creada que no tiene mesas. El sistema hace un Hard Delete.

CU-Z05 (Borrado Híbrido - Soft Delete): Borrar una Zona que ya tuvo operación histórica. El sistema hace un Soft Delete (is_active = false).

CU-Z06 (Borrado - Error Protegido): Intentar borrar una Zona que actualmente tiene mesas activas en su interior. El sistema debe bloquear la acción exigiendo que primero se muevan o borren las mesas.

🪑 Grupo 2: Gestión de Mesas y Comensales
CU-M01 (Creación - Éxito): Crear una Mesa asignada a una Zona (ej. "T-01"), definiendo su capacidad (ej. capacity: 4).

CU-M02 (Creación - Error): Intentar crear una Mesa asignándola a un ZoneCode inactivo o inexistente.

CU-M03 (Edición - Éxito): Modificar la capacidad de comensales de una Mesa o cambiarla a otra Zona (Reubicación).

CU-M04 (Borrado Híbrido - Éxito Limpio): Borrar una mesa que nunca ha tenido una comanda (ej. error de dedo). El sistema hace un Hard Delete.

CU-M05 (Borrado Híbrido - Soft Delete): Borrar una mesa que tiene ventas registradas en el pasado. El sistema hace un Soft Delete para proteger los reportes financieros.

🧑‍🍳 Grupo 3: Asignación Operativa (Meseros x Turno x Zona)
CU-A01 (Creación - Éxito): Asignar un empleado activo a una Zona específica, para una Fecha específica y un Turno (ej. Shift: "Matutino").

CU-A02 (Creación - Error Anti-Colisión): Intentar asignar al mismo empleado a dos Zonas diferentes en el mismo Turno y Fecha. El sistema lo bloquea.

CU-A03 (Edición - Éxito): Reasignar a un empleado (Update). Moverlo de "Terraza" a "Salón" para el mismo turno/fecha.

CU-A04 (Borrado - Éxito): Eliminar la asignación de un mesero para un turno futuro (ej. el empleado se reportó enfermo). Aquí siempre es Hard Delete porque la asignación en sí misma no es una venta.