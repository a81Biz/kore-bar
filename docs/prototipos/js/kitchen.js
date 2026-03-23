// ============================================
// MÓDULO DE COCINA
// ============================================

RestaurantApp.prototype.initKitchenPanel = function() {
    this.renderKitchenBoard('time');
};

RestaurantApp.prototype.renderKitchenBoard = function(sortBy = 'time') {
    const board = document.getElementById('kitchen-board');
    
    // Filtrar pedidos pendientes y en proceso
    let orders = AppData.orders.filter(o => 
        o.estado === 'pendiente' || o.estado === 'en_proceso'
    );

    // Ordenar según criterio
    switch(sortBy) {
        case 'time':
            orders.sort((a, b) => a.fechaHora - b.fechaHora);
            break;
        case 'table':
            orders.sort((a, b) => {
                const tableA = DataUtils.getTableById(a.mesaId);
                const tableB = DataUtils.getTableById(b.mesaId);
                return tableA.numero - tableB.numero;
            });
            break;
        case 'urgency':
            orders.sort((a, b) => {
                const timeA = new Date() - a.fechaHora;
                const timeB = new Date() - b.fechaHora;
                return timeB - timeA; // Más antiguo primero
            });
            break;
    }

    if (orders.length === 0) {
        board.innerHTML = `
            <div class="text-center" style="grid-column: 1/-1; padding: 3rem;">
                <i class="fas fa-utensils" style="font-size: 4rem; color: #ddd;"></i>
                <h3 style="color: #666; margin-top: 1rem;">No hay pedidos pendientes</h3>
            </div>
        `;
        return;
    }

    board.innerHTML = orders.map(order => {
        const table = DataUtils.getTableById(order.mesaId);
        const isUrgent = (new Date() - order.fechaHora) > 30 * 60 * 1000; // Más de 30 min

        return `
            <div class="order-ticket ${isUrgent ? 'urgent' : ''}">
                <div class="ticket-header">
                    <span class="table-number">Mesa ${table ? table.numero : '?'}</span>
                    <span class="time">${DataUtils.formatTime(order.fechaHora)}</span>
                </div>
                <div class="ticket-items">
                    ${order.items.map((item, index) => {
                        const dish = DataUtils.getDishById(item.platilloId);
                        const isCompleted = item.estado === 'listo' || item.estado === 'entregado';
                        return `
                            <div class="ticket-item ${isCompleted ? 'completed' : ''}" 
                                 data-order="${order.id}" data-item="${index}">
                                <div>
                                    <strong>${item.cantidad}x</strong> ${dish ? dish.nombre : 'Desconocido'}
                                    ${item.notas ? `<br><small>${item.notas}</small>` : ''}
                                </div>
                                <span class="item-status ${item.estado}">
                                    ${item.estado === 'pendiente' ? 'Pendiente' : 
                                      item.estado === 'cocinando' ? 'Cocinando' : 'Listo'}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="ticket-actions">
                    <button class="complete" onclick="app.markOrderComplete(${order.id})">
                        <i class="fas fa-check"></i> Marcar Todo como Listo
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Agregar event listeners para items individuales
    document.querySelectorAll('.ticket-item:not(.completed)').forEach(item => {
        item.addEventListener('click', () => {
            const orderId = parseInt(item.dataset.order);
            const itemIndex = parseInt(item.dataset.item);
            this.markItemComplete(orderId, itemIndex);
        });
    });
};

RestaurantApp.prototype.markItemComplete = function(orderId, itemIndex) {
    const order = AppData.orders.find(o => o.id === orderId);
    if (!order || !order.items[itemIndex]) return;

    const item = order.items[itemIndex];
    item.estado = 'listo';
    item.horaFinalizacion = new Date();

    this.showToast(`${DataUtils.getDishById(item.platilloId)?.nombre} marcado como listo`, 'success');
    this.renderKitchenBoard(document.getElementById('kitchen-sort').value);

    // Notificar al mesero
    const table = DataUtils.getTableById(order.mesaId);
    this.notifyWaiter(`Pedido Mesa ${table?.numero} - ${DataUtils.getDishById(item.platilloId)?.nombre} listo`);
};

RestaurantApp.prototype.markOrderComplete = function(orderId) {
    const order = AppData.orders.find(o => o.id === orderId);
    if (!order) return;

    order.items.forEach(item => {
        if (item.estado !== 'listo') {
            item.estado = 'listo';
            item.horaFinalizacion = new Date();
        }
    });

    order.estado = 'listo';
    this.showToast(`Pedido Mesa ${DataUtils.getTableById(order.mesaId)?.numero} completo`, 'success');
    this.renderKitchenBoard(document.getElementById('kitchen-sort').value);

    // Notificar a todos los meseros
    this.notifyWaiter(`Pedido Mesa ${DataUtils.getTableById(order.mesaId)?.numero} listo para entregar`);
};

RestaurantApp.prototype.checkNewOrders = function() {
    // En producción, esto sería una conexión WebSocket
    // Aquí simulamos la llegada de nuevos pedidos
    const pendingOrders = AppData.orders.filter(o => 
        o.estado === 'pendiente' || o.estado === 'en_proceso'
    ).length;
    
    console.log(`Pedidos en cocina: ${pendingOrders}`);
};