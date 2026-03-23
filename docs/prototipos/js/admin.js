// ============================================
// MÓDULO DE ADMINISTRADOR
// ============================================

RestaurantApp.prototype.initAdminPanel = function() {
    this.renderDashboard();
};

RestaurantApp.prototype.renderDashboard = function() {
    // Actualizar estadísticas
    document.getElementById('total-tables').textContent = AppData.tables.length;
    document.getElementById('active-waiters').textContent = AppData.waiters.filter(w => w.estado === 'activo').length;
    document.getElementById('today-orders').textContent = AppData.orders.length;
    
    const totalRevenue = AppData.orders.reduce((sum, o) => sum + o.total, 0);
    document.getElementById('today-revenue').textContent = this.formatCurrency(totalRevenue);

    // Renderizar notificaciones
    const notificationsList = document.getElementById('admin-notifications');
    notificationsList.innerHTML = AppData.notifications.slice(0, 5).map(n => `
        <li><i class="fas fa-${n.tipo === 'stock_bajo' ? 'exclamation-triangle' : 'bell'}"></i> ${n.mensaje}</li>
    `).join('');
};

RestaurantApp.prototype.renderTables = function() {
    const container = document.getElementById('tables-container');
    const shift = document.getElementById('shift-select').value;

    container.innerHTML = AppData.tables.map(table => {
        const waiter = table.meseroId ? DataUtils.getWaiterById(table.meseroId) : null;
        return `
            <div class="table-card ${table.estado}" onclick="app.selectTable(${table.id})">
                <h3>Mesa ${table.numero}</h3>
                <p>Capacidad: ${table.capacidad} personas</p>
                ${waiter ? `<p>Mesero: ${waiter.nombre} ${waiter.apellido}</p>` : '<p>Sin asignar</p>'}
                <span class="status ${table.estado}">${table.estado === 'ocupada' ? 'Ocupada' : 'Disponible'}</span>
            </div>
        `;
    }).join('');
};

RestaurantApp.prototype.selectTable = function(tableId) {
    const table = DataUtils.getTableById(tableId);
    if (table) {
        // Mostrar modal de edición de mesa
        this.showToast(`Mesa ${table.numero} seleccionada`, 'info');
    }
};

RestaurantApp.prototype.addTable = function() {
    const newId = AppData.tables.length + 1;
    AppData.tables.push({
        id: newId,
        numero: newId,
        capacidad: 4,
        estado: 'disponible',
        meseroId: null,
        qrCode: `QR${String(newId).padStart(3, '0')}`
    });
    this.renderTables();
    this.showToast('Mesa agregada exitosamente', 'success');
};

RestaurantApp.prototype.saveTableConfig = function() {
    this.showToast('Configuración guardada', 'success');
};

RestaurantApp.prototype.renderWaiters = function() {
    const tbody = document.getElementById('waiters-table-body');
    tbody.innerHTML = AppData.waiters.map(w => {
        const table = w.mesaAsignada ? DataUtils.getTableById(w.mesaAsignada) : null;
        return `
            <tr>
                <td>${w.id}</td>
                <td>${w.nombre}</td>
                <td>${w.apellido}</td>
                <td>${w.turno}</td>
                <td>${table ? `Mesa ${table.numero}` : 'Sin asignar'}</td>
                <td><span class="status-badge ${w.estado === 'activo' ? 'open' : 'closed'}">${w.estado}</span></td>
                <td>
                    <button class="btn-secondary" onclick="app.editWaiter('${w.id}')"><i class="fas fa-edit"></i></button>
                </td>
            </tr>
        `;
    }).join('');
};

RestaurantApp.prototype.syncWaiters = function() {
    this.showToast('Sincronizando con RRHH...', 'info');
    setTimeout(() => {
        this.showToast('Sincronización completada', 'success');
    }, 1500);
};

RestaurantApp.prototype.editWaiter = function(waiterId) {
    this.showToast(`Editando mesero ${waiterId}`, 'info');
};

RestaurantApp.prototype.renderAdminMenu = function() {
    const container = document.getElementById('menu-container');
    const filter = document.getElementById('menu-filter').value;

    let dishes = AppData.menu;
    if (filter !== 'all') {
        dishes = dishes.filter(d => d.categoria === filter);
    }

    container.innerHTML = dishes.map(dish => `
        <div class="dish-card">
            <div class="dish-image">${dish.icon}</div>
            <div class="dish-info">
                <h3>${dish.nombre}</h3>
                <p>${dish.descripcion}</p>
                <div class="price">${this.formatCurrency(dish.precio)}</div>
                <div class="dish-actions">
                    <button class="btn-secondary" onclick="app.editDish(${dish.id})">Editar</button>
                    <button class="btn-${dish.disponible ? 'secondary' : 'primary'}" onclick="app.toggleDishAvailability(${dish.id})">
                        ${dish.disponible ? 'Desactivar' : 'Activar'}
                    </button>
                </div>
            </div>
        </div>
    `).join('');
};

RestaurantApp.prototype.showAddDishModal = function() {
    document.getElementById('dish-form').reset();
    this.openModal('dish-modal');
};

RestaurantApp.prototype.saveDish = function() {
    const newDish = {
        id: AppData.menu.length + 1,
        nombre: document.getElementById('dish-name').value,
        descripcion: document.getElementById('dish-description').value,
        categoria: document.getElementById('dish-category').value,
        precio: parseFloat(document.getElementById('dish-price').value),
        ivaIncluido: document.getElementById('dish-iva').checked,
        tiempoPrep: parseInt(document.getElementById('dish-time').value),
        disponible: document.getElementById('dish-available').checked,
        icon: '🍽️'
    };

    AppData.menu.push(newDish);
    this.closeModal('dish-modal');
    this.renderAdminMenu();
    this.showToast('Platillo registrado exitosamente', 'success');
};

RestaurantApp.prototype.editDish = function(dishId) {
    this.showToast(`Editando platillo ${dishId}`, 'info');
};

RestaurantApp.prototype.toggleDishAvailability = function(dishId) {
    const dish = DataUtils.getDishById(dishId);
    if (dish) {
        dish.disponible = !dish.disponible;
        this.renderAdminMenu();
        this.showToast(`Platillo ${dish.disponible ? 'activado' : 'desactivado'}`, 'success');
    }
};

RestaurantApp.prototype.renderReports = function() {
    const tbody = document.getElementById('reports-table-body');
    tbody.innerHTML = AppData.orders.map(order => {
        const table = DataUtils.getTableById(order.mesaId);
        const waiter = DataUtils.getWaiterById(order.meseroId);
        return `
            <tr>
                <td>${table ? table.numero : '-'}</td>
                <td>${waiter ? `${waiter.nombre} ${waiter.apellido}` : '-'}</td>
                <td>${waiter ? waiter.turno : '-'}</td>
                <td>${order.items.length}</td>
                <td>${this.formatCurrency(order.total)}</td>
                <td>${DataUtils.formatDateTime(order.fechaHora)}</td>
            </tr>
        `;
    }).join('');
};

RestaurantApp.prototype.generateReport = function() {
    this.showToast('Generando reporte...', 'info');
    setTimeout(() => {
        this.showToast('Reporte generado', 'success');
    }, 1000);
};

RestaurantApp.prototype.exportReport = function(format) {
    this.showToast(`Exportando a ${format.toUpperCase()}...`, 'info');
};

RestaurantApp.prototype.renderAttendance = function() {
    const tbody = document.getElementById('attendance-table-body');
    const date = document.getElementById('attendance-date').value || new Date().toISOString().split('T')[0];
    const shift = document.getElementById('attendance-shift').value;

    const attendance = AppData.attendance.filter(a => a.fecha === date && a.turno === shift);

    tbody.innerHTML = attendance.map(a => {
        const waiter = DataUtils.getWaiterById(a.meseroId);
        return `
            <tr>
                <td>${a.meseroId}</td>
                <td>${waiter ? `${waiter.nombre} ${waiter.apellido}` : '-'}</td>
                <td>${a.turno}</td>
                <td><span class="status-badge ${a.presente ? 'open' : 'closed'}">${a.presente ? 'Presente' : 'Ausente'}</span></td>
                <td>${a.justificante || '-'}</td>
                <td>${a.descuento > 0 ? this.formatCurrency(a.descuento) : '$0.00'}</td>
                <td>
                    <button class="btn-secondary" onclick="app.registerAttendance('${a.meseroId}', '${a.turno}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
};

RestaurantApp.prototype.registerAttendance = function(waiterId, shift) {
    this.showToast(`Registrando asistencia para ${waiterId}`, 'info');
};

RestaurantApp.prototype.renderInventory = function() {
    const tbody = document.getElementById('inventory-table-body');
    
    // Actualizar contadores
    const lowStock = AppData.inventory.filter(i => i.stockActual < i.stockMinimo).length;
    document.getElementById('low-stock-count').textContent = lowStock;

    tbody.innerHTML = AppData.inventory.map(item => `
        <tr>
            <td>${item.nombre}</td>
            <td>${item.unidad}</td>
            <td>${item.stockActual}</td>
            <td>${item.stockMinimo}</td>
            <td>${item.consumoHoy}</td>
            <td>
                <span class="status-badge ${item.stockActual < item.stockMinimo ? 'closed' : 'open'}">
                    ${item.stockActual < item.stockMinimo ? 'Stock Bajo' : 'OK'}
                </span>
            </td>
        </tr>
    `).join('');
};

RestaurantApp.prototype.calculateDailyConsumption = function() {
    this.showToast('Calculando consumo diario...', 'info');
    setTimeout(() => {
        this.showToast('Consumo calculado exitosamente', 'success');
        this.renderInventory();
    }, 1500);
};

RestaurantApp.prototype.generateSupplierOrders = function() {
    this.showToast('Generando pedidos a proveedores...', 'info');
    setTimeout(() => {
        this.showToast('Pedidos generados y enviados', 'success');
    }, 2000);
};

// Event listener para filtro de menú admin
document.getElementById('menu-filter')?.addEventListener('change', () => {
    app.renderAdminMenu();
});

// Event listener para selector de turno en mesas
document.getElementById('shift-select')?.addEventListener('change', () => {
    app.renderTables();
});