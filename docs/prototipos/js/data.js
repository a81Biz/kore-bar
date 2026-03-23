// ============================================
// DATOS SIMULADOS DEL SISTEMA
// ============================================

const AppData = {
    // Meseros (simulando integración con RRHH)
    waiters: [
        { id: 'M001', nombre: 'María', apellido: 'López', turno: 'matutino', mesaAsignada: 1, estado: 'activo' },
        { id: 'M002', nombre: 'Juan', apellido: 'Pérez', turno: 'matutino', mesaAsignada: 2, estado: 'activo' },
        { id: 'M003', nombre: 'Ana', apellido: 'García', turno: 'matutino', mesaAsignada: 3, estado: 'activo' },
        { id: 'M004', nombre: 'Carlos', apellido: 'Rodríguez', turno: 'matutino', mesaAsignada: 4, estado: 'activo' },
        { id: 'M005', nombre: 'Laura', apellido: 'Martínez', turno: 'matutino', mesaAsignada: 5, estado: 'activo' },
        { id: 'M006', nombre: 'Pedro', apellido: 'Sánchez', turno: 'vespertino', mesaAsignada: 6, estado: 'activo' },
        { id: 'M007', nombre: 'Sofía', apellido: 'Hernández', turno: 'vespertino', mesaAsignada: 7, estado: 'activo' },
        { id: 'M008', nombre: 'Miguel', apellido: 'Díaz', turno: 'vespertino', mesaAsignada: 8, estado: 'ausente' },
        { id: 'M009', nombre: 'Elena', apellido: 'Torres', turno: 'vespertino', mesaAsignada: 9, estado: 'activo' },
        { id: 'M010', nombre: 'Roberto', apellido: 'Flores', turno: 'vespertino', mesaAsignada: 10, estado: 'activo' }
    ],

    // Mesas
    tables: Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        numero: i + 1,
        capacidad: i % 3 === 0 ? 6 : (i % 2 === 0 ? 4 : 2),
        estado: i < 8 ? 'ocupada' : 'disponible',
        meseroId: i < 8 ? `M00${(i % 5) + 1}` : null,
        qrCode: `QR${String(i + 1).padStart(3, '0')}`
    })),

    // Platillos del Menú
    menu: [
        { id: 1, nombre: 'Guacamole con Totopos', descripcion: 'Aguacate fresco con tomate, cebolla y cilantro', categoria: 'entradas', precio: 85.00, ivaIncluido: true, tiempoPrep: 5, disponible: true, icon: '🥑' },
        { id: 2, nombre: 'Quesadillas de Flor de Calabaza', descripcion: 'Tortilla hecha a mano con flor de calabaza y queso', categoria: 'entradas', precio: 95.00, ivaIncluido: true, tiempoPrep: 10, disponible: true, icon: '🌮' },
        { id: 3, nombre: 'Sopa de Tortilla', descripcion: 'Caldo de tomate con tiras de tortilla, aguacate y queso', categoria: 'entradas', precio: 75.00, ivaIncluido: true, tiempoPrep: 8, disponible: true, icon: '🍲' },
        { id: 4, nombre: 'Tacos al Pastor', descripcion: '3 tacos con cerdo adobado, piña y cilantro', categoria: 'platos', precio: 120.00, ivaIncluido: true, tiempoPrep: 15, disponible: true, icon: '🌮' },
        { id: 5, nombre: 'Enchiladas Verdes', descripcion: '3 enchiladas de pollo con salsa verde y crema', categoria: 'platos', precio: 145.00, ivaIncluido: true, tiempoPrep: 20, disponible: true, icon: '🌯' },
        { id: 6, nombre: 'Mole Poblano', descripcion: 'Pollo en mole tradicional con arroz y tortillas', categoria: 'platos', precio: 185.00, ivaIncluido: true, tiempoPrep: 25, disponible: true, icon: '🍗' },
        { id: 7, nombre: 'Cochinita Pibil', descripcion: 'Cerdo marinado en achiote con cebolla encurtida', categoria: 'platos', precio: 195.00, ivaIncluido: true, tiempoPrep: 30, disponible: true, icon: '🐖' },
        { id: 8, nombre: 'Pescado a la Talla', descripcion: 'Pescado entero asado con salsa roja o verde', categoria: 'platos', precio: 225.00, ivaIncluido: true, tiempoPrep: 25, disponible: true, icon: '🐟' },
        { id: 9, nombre: 'Agua de Horchata', descripcion: 'Bebida tradicional de arroz y canela', categoria: 'bebidas', precio: 35.00, ivaIncluido: true, tiempoPrep: 2, disponible: true, icon: '🥤' },
        { id: 10, nombre: 'Agua de Jamaica', descripcion: 'Bebida refrescante de flor de jamaica', categoria: 'bebidas', precio: 35.00, ivaIncluido: true, tiempoPrep: 2, disponible: true, icon: '🌺' },
        { id: 11, nombre: 'Cerveza Nacional', descripcion: 'Corona, Modelo o Pacifico', categoria: 'bebidas', precio: 55.00, ivaIncluido: true, tiempoPrep: 1, disponible: true, icon: '🍺' },
        { id: 12, nombre: 'Margarita Clásica', descripcion: 'Tequila, limón y triple sec', categoria: 'bebidas', precio: 95.00, ivaIncluido: true, tiempoPrep: 5, disponible: true, icon: '🍹' },
        { id: 13, nombre: 'Churros con Chocolate', descripcion: '5 churros con salsa de chocolate caliente', categoria: 'postres', precio: 65.00, ivaIncluido: true, tiempoPrep: 10, disponible: true, icon: '🍩' },
        { id: 14, nombre: 'Flan Napolitano', descripcion: 'Flan de huevo con caramelo', categoria: 'postres', precio: 55.00, ivaIncluido: true, tiempoPrep: 3, disponible: true, icon: '🍮' },
        { id: 15, nombre: 'Tres Leches', descripcion: 'Pastel bañado en tres tipos de leche', categoria: 'postres', precio: 60.00, ivaIncluido: true, tiempoPrep: 3, disponible: true, icon: '🍰' }
    ],

    // Pedidos Activos
    orders: [
        {
            id: 1,
            mesaId: 1,
            meseroId: 'M001',
            fechaHora: new Date('2024-01-15T10:30:00'),
            estado: 'en_proceso',
            items: [
                { platilloId: 4, cantidad: 2, estado: 'listo', horaSolicitud: new Date('2024-01-15T10:30:00'), horaFinalizacion: new Date('2024-01-15T10:45:00') },
                { platilloId: 9, cantidad: 2, estado: 'listo', horaSolicitud: new Date('2024-01-15T10:30:00'), horaFinalizacion: new Date('2024-01-15T10:32:00') }
            ],
            subtotal: 310.00,
            iva: 49.60,
            total: 359.60
        },
        {
            id: 2,
            mesaId: 3,
            meseroId: 'M003',
            fechaHora: new Date('2024-01-15T11:00:00'),
            estado: 'pendiente',
            items: [
                { platilloId: 1, cantidad: 1, estado: 'pendiente', horaSolicitud: new Date('2024-01-15T11:00:00') },
                { platilloId: 6, cantidad: 2, estado: 'pendiente', horaSolicitud: new Date('2024-01-15T11:00:00') },
                { platilloId: 10, cantidad: 2, estado: 'pendiente', horaSolicitud: new Date('2024-01-15T11:00:00') }
            ],
            subtotal: 485.00,
            iva: 77.60,
            total: 562.60
        },
        {
            id: 3,
            mesaId: 5,
            meseroId: 'M005',
            fechaHora: new Date('2024-01-15T11:15:00'),
            estado: 'en_proceso',
            items: [
                { platilloId: 7, cantidad: 1, estado: 'cocinando', horaSolicitud: new Date('2024-01-15T11:15:00') },
                { platilloId: 12, cantidad: 2, estado: 'listo', horaSolicitud: new Date('2024-01-15T11:15:00'), horaFinalizacion: new Date('2024-01-15T11:20:00') }
            ],
            subtotal: 385.00,
            iva: 61.60,
            total: 446.60
        }
    ],

    // Inventario de Alimentos
    inventory: [
        { alimentoId: 1, nombre: 'Carne de Res', unidad: 'kg', stockActual: 25, stockMinimo: 30, consumoHoy: 12, proveedor: 'Cárnicos del Sur' },
        { alimentoId: 2, nombre: 'Pollo', unidad: 'kg', stockActual: 40, stockMinimo: 35, consumoHoy: 18, proveedor: 'Avícola Central' },
        { alimentoId: 3, nombre: 'Tortillas', unidad: 'kg', stockActual: 50, stockMinimo: 40, consumoHoy: 25, proveedor: 'Tortillería La Espiga' },
        { alimentoId: 4, nombre: 'Aguacate', unidad: 'kg', stockActual: 15, stockMinimo: 20, consumoHoy: 8, proveedor: 'Frutas y Verduras MX' },
        { alimentoId: 5, nombre: 'Tomate', unidad: 'kg', stockActual: 30, stockMinimo: 25, consumoHoy: 10, proveedor: 'Frutas y Verduras MX' },
        { alimentoId: 6, nombre: 'Cebolla', unidad: 'kg', stockActual: 20, stockMinimo: 15, consumoHoy: 5, proveedor: 'Frutas y Verduras MX' },
        { alimentoId: 7, nombre: 'Queso', unidad: 'kg', stockActual: 18, stockMinimo: 20, consumoHoy: 7, proveedor: 'Lácteos Regionales' },
        { alimentoId: 8, nombre: 'Cerveza', unidad: 'pz', stockActual: 120, stockMinimo: 100, consumoHoy: 45, proveedor: 'Distribuidora de Bebidas' },
        { alimentoId: 9, nombre: 'Refrescos', unidad: 'pz', stockActual: 80, stockMinimo: 60, consumoHoy: 30, proveedor: 'Distribuidora de Bebidas' },
        { alimentoId: 10, nombre: 'Harina', unidad: 'kg', stockActual: 35, stockMinimo: 30, consumoHoy: 8, proveedor: 'Granos y Semillas' }
    ],

    // Proveedores
    suppliers: [
        { id: 1, nombre: 'Cárnicos del Sur', contacto: 'Juan Ramírez', telefono: '55-1234-5678', email: 'ventas@carnicosdelsur.com', alimentos: [1], tiempoEntrega: 1, calificacion: 4.5 },
        { id: 2, nombre: 'Avícola Central', contacto: 'María González', telefono: '55-2345-6789', email: 'pedidos@avicola.com', alimentos: [2], tiempoEntrega: 1, calificacion: 4.3 },
        { id: 3, nombre: 'Tortillería La Espiga', contacto: 'Roberto Díaz', telefono: '55-3456-7890', email: 'contacto@laespiga.com', alimentos: [3], tiempoEntrega: 0, calificacion: 4.8 },
        { id: 4, nombre: 'Frutas y Verduras MX', contacto: 'Ana López', telefono: '55-4567-8901', email: 'ventas@frutasmx.com', alimentos: [4, 5, 6], tiempoEntrega: 1, calificacion: 4.2 },
        { id: 5, nombre: 'Lácteos Regionales', contacto: 'Carlos Mendez', telefono: '55-5678-9012', email: 'pedidos@lacteos.com', alimentos: [7], tiempoEntrega: 2, calificacion: 4.0 },
        { id: 6, nombre: 'Distribuidora de Bebidas', contacto: 'Laura Torres', telefono: '55-6789-0123', email: 'ventas@bebidas.com', alimentos: [8, 9], tiempoEntrega: 1, calificacion: 4.6 },
        { id: 7, nombre: 'Granos y Semillas', contacto: 'Pedro Flores', telefono: '55-7890-1234', email: 'contacto@granos.com', alimentos: [10], tiempoEntrega: 2, calificacion: 4.1 }
    ],

    // Asistencias
    attendance: [
        { fecha: '2024-01-15', turno: 'matutino', meseroId: 'M001', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'matutino', meseroId: 'M002', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'matutino', meseroId: 'M003', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'matutino', meseroId: 'M004', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'matutino', meseroId: 'M005', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'vespertino', meseroId: 'M006', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'vespertino', meseroId: 'M007', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'vespertino', meseroId: 'M008', presente: false, justificante: 'Enfermedad', descuento: 150 },
        { fecha: '2024-01-15', turno: 'vespertino', meseroId: 'M009', presente: true, justificante: '', descuento: 0 },
        { fecha: '2024-01-15', turno: 'vespertino', meseroId: 'M010', presente: true, justificante: '', descuento: 0 }
    ],

    // Notificaciones
    notifications: [
        { id: 1, tipo: 'stock_bajo', mensaje: 'Stock bajo: Carne de res', fecha: new Date(), leido: false },
        { id: 2, tipo: 'ausencia', mensaje: 'Ausencia: Juan Pérez (Matutino)', fecha: new Date(), leido: false },
        { id: 3, tipo: 'pedido_listo', mensaje: 'Pedido Mesa 01 listo para entregar', fecha: new Date(), leido: false }
    ]
};

// Funciones de utilidad para datos
const DataUtils = {
    getWaiterById(id) {
        return AppData.waiters.find(w => w.id === id);
    },

    getTableById(id) {
        return AppData.tables.find(t => t.id === id);
    },

    getDishById(id) {
        return AppData.menu.find(d => d.id === id);
    },

    getOrderById(id) {
        return AppData.orders.find(o => o.id === id);
    },

    getOrdersByTable(tableId) {
        return AppData.orders.filter(o => o.mesaId === tableId);
    },

    getOrdersByWaiter(waiterId) {
        return AppData.orders.filter(o => o.meseroId === waiterId);
    },

    calculateTotal(items) {
        return items.reduce((sum, item) => {
            const dish = this.getDishById(item.platilloId);
            return sum + (dish.precio * item.cantidad);
        }, 0);
    },

    calculateIVA(subtotal) {
        return subtotal * 0.16;
    },

    formatCurrency(amount) {
        return '$' + amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
    },

    formatTime(date) {
        return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    },

    formatDateTime(date) {
        return date.toLocaleString('es-MX');
    }
};