// ============================================
// MÓDULO DE MESERO
// ============================================

RestaurantApp.prototype.renderWaiterTablesList = function() {
    const list = document.getElementById('waiter-tables-list');
    const assignedTables = AppData.tables.filter(t => t.meseroId === this.currentWaiter?.id);

    list.innerHTML = assignedTables.map(table => `
        <li class="${this.currentTable?.id === table.id ? 'active' : ''}" 
            onclick="app.selectWaiterTable(${table.id})">
            <i class="fas fa-chair"></i> Mesa ${table.numero}
            <span class="status-badge ${table.estado === 'ocupada' ? 'open' : 'closed'}">
                ${table.estado}
            </span>
        </li>
    `).join('');
};

RestaurantApp.prototype.selectWaiterTable = function(tableId) {
    this.currentTable = DataUtils.getTableById(tableId);
    document.getElementById('current-table').textContent = `Mesa #${this.currentTable.numero}`;
    
    // Actualizar lista de mesas
    this.renderWaiterTablesList();
    
    // Cargar pedido actual o crear nuevo
    this.currentOrder = AppData.orders.find(o => o.mesaId === tableId && o.estado !== 'pagado');
    
    if (!this.currentOrder) {
        this.currentOrder = {
            id: AppData.orders.length + 1,
            mesaId: tableId,
            meseroId: this.currentWaiter.id,
            fechaHora: new Date(),
            estado: 'pendiente',
            items: [],
            subtotal: 0,
            iva: 0,
            total: 0
        };
    }
    
    document.getElementById('order-status').textContent = this.currentOrder.estado.replace('_', ' ').toUpperCase();
    this.renderCurrentOrder();
    this.renderWaiterMenu('todos');
};

RestaurantApp.prototype.renderWaiterMenu = function(category) {
    const container = document.getElementById('waiter-menu-items');
    
    // Actualizar botones de categoría
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === category);
    });

    let dishes = AppData.menu.filter(d => d.disponible);
    if (category !== 'todos') {
        dishes = dishes.filter(d => d.categoria === category);
    }

    container.innerHTML = dishes.map(dish => `
        <div class="menu-item" onclick="app.addToOrder(${dish.id})">
            <div class="icon">${dish.icon}</div>
            <div class="name">${dish.nombre}</div>
            <div class="price">${this.formatCurrency(dish.precio)}</div>
        </div>
    `).join('');
};

RestaurantApp.prototype.filterWaiterMenu = function(category) {
    this.renderWaiterMenu(category);
};

RestaurantApp.prototype.addToOrder = function(dishId) {
    const dish = DataUtils.getDishById(dishId);
    if (!dish) return;

    const existingItem = this.currentOrder.items.find(i => i.platilloId === dishId);
    
    if (existingItem) {
        existingItem.cantidad++;
    } else {
        this.currentOrder.items.push({
            platilloId: dishId,
            cantidad: 1,
            estado: 'pendiente',
            horaSolicitud: new Date()
        });
    }

    this.renderCurrentOrder();
    this.showToast(`${dish.nombre} agregado`, 'success');
};

RestaurantApp.prototype.renderCurrentOrder = function() {
    const container = document.getElementById('current-order-items');
    
    if (this.currentOrder.items.length === 0) {
        container.innerHTML = '<p class="text-center">Sin items en el pedido</p>';
    } else {
        container.innerHTML = this.currentOrder.items.map((item, index) => {
            const dish = DataUtils.getDishById(item.platilloId);
            return `
                <div class="order-item">
                    <div>
                        <strong>${dish.nombre}</strong><br>
                        <small>${this.formatCurrency(dish.precio)} c/u</small>
                    </div>
                    <div class="qty-controls">
                        <button onclick="app.updateQuantity(${index}, -1)">-</button>
                        <span>${item.cantidad}</span>
                        <button onclick="app.updateQuantity(${index}, 1)">+</button>
                        <button onclick="app.removeFromOrder(${index})" style="color: red; margin-left: 5px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Calcular totales
    this.currentOrder.subtotal = DataUtils.calculateTotal(this.currentOrder.items);
    this.currentOrder.iva = DataUtils.calculateIVA(this.currentOrder.subtotal);
    this.currentOrder.total = this.currentOrder.subtotal + this.currentOrder.iva;

    document.getElementById('order-subtotal').textContent = this.formatCurrency(this.currentOrder.subtotal);
    document.getElementById('order-iva').textContent = this.formatCurrency(this.currentOrder.iva);
    document.getElementById('order-total').textContent = this.formatCurrency(this.currentOrder.total);
};

RestaurantApp.prototype.updateQuantity = function(index, delta) {
    const item = this.currentOrder.items[index];
    item.cantidad += delta;
    
    if (item.cantidad <= 0) {
        this.currentOrder.items.splice(index, 1);
    }
    
    this.renderCurrentOrder();
};

RestaurantApp.prototype.removeFromOrder = function(index) {
    this.currentOrder.items.splice(index, 1);
    this.renderCurrentOrder();
};

RestaurantApp.prototype.sendOrder = function() {
    if (this.currentOrder.items.length === 0) {
        this.showToast('El pedido está vacío', 'warning');
        return;
    }

    this.currentOrder.estado = 'en_proceso';
    this.currentOrder.fechaHora = new Date();
    
    // Agregar a la lista global de pedidos
    const existingOrderIndex = AppData.orders.findIndex(o => o.id === this.currentOrder.id);
    if (existingOrderIndex >= 0) {
        AppData.orders[existingOrderIndex] = this.currentOrder;
    } else {
        AppData.orders.push(this.currentOrder);
    }

    this.showToast('Pedido enviado a cocina', 'success');
    this.renderCurrentOrder();
    
    // Simular notificación a cocina (en producción sería WebSocket)
    console.log('Nuevo pedido enviado a cocina:', this.currentOrder);
};

RestaurantApp.prototype.printBill = function() {
    if (this.currentOrder.items.length === 0) {
        this.showToast('No hay pedido para imprimir', 'warning');
        return;
    }

    this.showToast('Imprimiendo cuenta...', 'info');
    setTimeout(() => {
        this.showToast('Cuenta impresa', 'success');
    }, 1000);
};

RestaurantApp.prototype.showInvoiceModal = function() {
    if (this.currentOrder.items.length === 0) {
        this.showToast('No hay pedido para facturar', 'warning');
        return;
    }
    this.openModal('invoice-modal');
};

RestaurantApp.prototype.generateInvoice = function() {
    const rfc = document.getElementById('inv-rfc').value;
    const email = document.getElementById('inv-email').value;

    if (!rfc || !email) {
        this.showToast('RFC y Email son requeridos', 'warning');
        return;
    }

    this.showToast('Generando factura SAT...', 'info');
    setTimeout(() => {
        this.showToast(`Factura enviada a ${email}`, 'success');
        this.closeModal('invoice-modal');
    }, 2000);
};

RestaurantApp.prototype.renderWaiterNotifications = function() {
    const list = document.getElementById('waiter-notifications');
    const notifications = AppData.notifications.filter(n => n.tipo === 'pedido_listo').slice(0, 5);

    if (notifications.length === 0) {
        list.innerHTML = '<li><i class="fas fa-check-circle"></i> Sin notificaciones nuevas</li>';
    } else {
        list.innerHTML = notifications.map(n => `
            <li>
                <i class="fas fa-bell"></i>
                <span>${n.mensaje}</span>
                <small>${DataUtils.formatTime(n.fecha)}</small>
            </li>
        `).join('');
    }
};