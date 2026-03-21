Flujo Operativo: Creación de Menú y Ciclo de Inventario

FASE 1: Diseño y Receta (Nace el Platillo)

1. 👤 Admin: Entra a admin.localhost y crea el "Cascarón" del platillo en el menú (Nombre, Descripción, Categoría, Precio de Venta). El sistema lo guarda en la tabla menu_dishes con estatus "Pendiente de Receta".

2. 👨‍🍳 Cocina: Entra a kitchen.localhost, revisa sus tareas y ve el nuevo platillo pendiente.

3. 👨‍🍳 Cocina (Validación de Insumos): Busca en la base de datos los ingredientes que necesita.

    * Ruta A (El insumo existe): Lo agrega a la receta (dish_recipes) indicando los gramos/mililitros exactos.

    * Ruta B (El insumo NO existe): Cocina lo da de alta en el sistema indicando cómo se usará.

4. 👨‍🍳 Cocina: Redacta el método de preparación, le toma una foto de referencia (image_url), y lo marca como "Terminado".

FASE 2: Revisión Comercial (El candado de Admin)
5. 👤 Admin (Validación Comercial): Entra a admin.localhost para revisar el platillo terminado. El sistema le muestra la receta completa, el método de preparación y la foto que tomó el chef.
6. 🔒 Restricción de Edición: Admin NO puede alterar los ingredientes ni las cantidades (eso alteraría el costeo y el Kardex operativo). Solo puede modificar:

    * El Nombre del platillo.
    * La Descripción comercial (lo que lee el cliente).
    * La Imagen (para reemplazar la foto del chef por una fotografía profesional de estudio).

FASE 3: Abastecimiento (Compras y Bodega)
7. 👤 Admin: Revisa el panel de alertas. Ve que la Cocina creó ingredientes nuevos que no existen en el inventario o que los mínimos calculados por el sistema (basados en las nuevas recetas) exigen resurtir.
8. 👤 Admin: Registra la Ingesta de Compras cuando llega el proveedor.
9. ⚙️ Sistema: Registra la entrada en el Kardex y asigna los paquetes enteros a la Bodega Principal (LOC-BODEGA).

FASE 4: Traspasos y Operación Diaria
10. 👨‍🍳 Cocina: Hace una Requisición a Bodega pidiendo insumos para el turno.
11. 👤 Admin: Autoriza y entrega físicamente.
12. ⚙️ Sistema: El Stored Procedure ejecuta la Partida Doble: resta en Bodega, convierte el empaque a gramos, y le suma el equivalente a la Cocina (LOC-COCINA).
13. 🍹 Punto de Venta: Se venden platillos. El sistema cruza las ventas con dish_recipes y descuenta teóricamente los insumos de la cocina.

FASE 5: Cierre, Contabilidad y Mermas
14. 👨‍🍳 Cocina: Al cerrar el turno, hace un Inventario Físico (Ciego) en kitchen.localhost.
15. ⚙️ Sistema: Calcula: Entradas de Bodega - Salidas por Ventas = Stock Teórico. Compara el Teórico vs el Físico reportado. Si hay diferencia, registra un ADJUSTMENT (Merma/Sobrante) en el Kardex de Cocina.
16. 👤 Admin: Revisa el Historial (Kardex) para ver entradas, salidas, mermas exactas, y anticipar compras.