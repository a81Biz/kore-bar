// ============================================
// APLICACIÓN PRINCIPAL
// ============================================

class RestaurantApp {
    constructor() {
        this.currentRole = null;
        this.currentWaiter = null;
        this.currentTable = null;
        this.currentOrder = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadInitialData();
        console.log('🌮 Sistema de Restaurante Iniciado');
    }

    setupEventListeners() {
        // Selección de rol en login
        document.querySelectorAll('.role-card').forEach(card => {
            card.addEventListener('click', () => {
                const role = card.dataset.role;
                this.login(role);
            });
        });

        // Navegación del admin
        document.querySelectorAll('.nav-menu li').forEach(item => {
            item.addEventListener('click', () => {
                this.switchAdminView(item.dataset.view);
            });
        });

        // Categorías del menú (mesero)
        document.querySelectorAll('.cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterWaiterMenu(btn.dataset.cat);
            });
        });

        // Categorías del menú (comensal)
        document.querySelectorAll('.customer-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterCustomerMenu(btn.dataset.cat);
            });
        });

        // Ordenamiento de cocina
        document.getElementById('kitchen-sort')?.addEventListener('change', (e) => {
            this.renderKitchenBoard(e.target.value);
        });

        // Cerrar modales con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });
    }

    loadInitialData() {
        // Cargar datos iniciales según el rol
        console.log('Datos cargados:', AppData);
    }

    login(role) {
        this.currentRole = role;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        switch(role) {
            case 'admin':
                document.getElementById('admin-screen').classList.add('active');
                this.initAdminPanel();
                break;
            case 'waiter':
                document.getElementById('waiter-screen').classList.add('active');
                this.initWaiterPanel();
                break;
            case 'kitchen':
                document.getElementById('kitchen-screen').classList.add('active');
                this.initKitchenPanel();
                break;
            case 'customer':
                document.getElementById('customer-screen').classList.add('active');
                this.initCustomerPanel();
                break;
        }

        this.showToast(`Bienvenido - Rol: ${role.toUpperCase()}`, 'success');
    }

    logout() {
        this.currentRole = null;
        this.currentWaiter = null;
        this.currentTable = null;
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('login-screen').classList.add('active');
        this.showToast('Sesión cerrada', 'warning');
    }

    switchAdminView(viewName) {
        document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));
        document.querySelector(`.nav-menu li[data-view="${viewName}"]`)?.classList.add('active');

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewName}`)?.classList.add('active');

        // Cargar datos específicos de la vista
        switch(viewName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'tables':
                this.renderTables();
                break;
            case 'waiters':
                this.renderWaiters();
                break;
            case 'menu':
                this.renderAdminMenu();
                break;
            case 'reports':
                this.renderReports();
                break;
            case 'attendance':
                this.renderAttendance();
                break;
            case 'inventory':
                this.renderInventory();
                break;
        }
    }

    // ============================================
    // FUNCIONES COMUNES
    // ============================================

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    closeModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    }

    openModal(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    }

    formatCurrency(amount) {
        return DataUtils.formatCurrency(amount);
    }

    // ============================================
    // INICIALIZACIÓN DE PANELES
    // ============================================

    initAdminPanel() {
        this.renderDashboard();
    }

    initWaiterPanel() {
        // Simular mesero logueado
        this.currentWaiter = AppData.waiters[0];
        document.getElementById('waiter-name').textContent = `Mesero: ${this.currentWaiter.nombre} ${this.currentWaiter.apellido}`;
        document.getElementById('waiter-shift').textContent = `Turno: ${this.currentWaiter.turno.charAt(0).toUpperCase() + this.currentWaiter.turno.slice(1)}`;
        
        // Obtener mesas asignadas
        const assignedTables = AppData.tables.filter(t => t.meseroId === this.currentWaiter.id);
        document.getElementById('waiter-tables').textContent = `Mesas: ${assignedTables.map(t => t.numero).join(', ')}`;
        
        this.renderWaiterTablesList();
        this.renderWaiterMenu('todos');
        this.renderWaiterNotifications();
        
        // Seleccionar primera mesa por defecto
        if (assignedTables.length > 0) {
            this.selectWaiterTable(assignedTables[0].id);
        }
    }

    initKitchenPanel() {
        this.renderKitchenBoard('time');
        // Simular actualizaciones en tiempo real
        setInterval(() => {
            this.checkNewOrders();
        }, 5000);
    }

    initCustomerPanel() {
        // Simular mesa desde QR
        this.currentTable = AppData.tables[0];
        document.getElementById('customer-table').textContent = `Mesa #${this.currentTable.numero}`;
        document.getElementById('customer-qr').textContent = `QR: ${this.currentTable.qrCode}`;
        
        this.renderCustomerMenu('todos');
    }

    // ============================================
    // SIMULACIÓN DE TIEMPO REAL
    // ============================================

    checkNewOrders() {
        // Simular llegada de nuevos pedidos
        console.log('Verificando nuevos pedidos...');
        // En producción esto sería vía WebSocket
    }

    notifyWaiter(message) {
        // Simular notificación push al mesero
        AppData.notifications.push({
            id: Date.now(),
            tipo: 'pedido_listo',
            mensaje: message,
            fecha: new Date(),
            leido: false
        });
        
        if (this.currentRole === 'waiter') {
            this.renderWaiterNotifications();
            this.showToast(message, 'success');
        }
    }
}

// Inicializar aplicación
const app = new RestaurantApp();

// Funciones globales para HTML
function logout() {
    app.logout();
}

function closeModal(modalId) {
    app.closeModal(modalId);
}