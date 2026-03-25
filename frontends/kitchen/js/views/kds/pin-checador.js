// frontends/kitchen/js/views/kds/pin-checador.js
//
// Controlador del panel flotante de check-in para cocina.
// Sigue el Patrón de Módulo Revelador en 7 Secciones (guía 05).
//
// Dependencias externas:
//   - ENDPOINTS.admin.get.employees   → cargar empleados de cocina
//   - ENDPOINTS.kitchen.post.clockIn  → POST /admin/auth/pin
//
// Publicado por KdsController via PubSub('OPEN_MODAL', 'pin-modal').
// Suscripción gestionada en app.js.

// ==========================================================================
// 1. DEPENDENCIAS
// ==========================================================================
import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showSuccessModal, showErrorModal } from '/shared/js/ui.js';

// ==========================================================================
// 2. ESTADO PRIVADO Y CONFIGURACIÓN
// ==========================================================================
const _state = {
    dom: {},
    pin: [],          // dígitos acumulados (máx 4)
    employees: []     // catálogo cargado una sola vez
};

const PIN_LENGTH = 4;

// ==========================================================================
// 3. CACHÉ DEL DOM  (se ejecuta UNA vez en init())
// ==========================================================================
const _cacheDOM = () => {
    _state.dom.panel = document.getElementById('modal-fast-pin');
    _state.dom.select = document.getElementById('pin-emp-select');
    _state.dom.numpad = document.getElementById('pin-numpad');
    _state.dom.btnClose = document.getElementById('btn-close-pin-modal');
    _state.dom.btnSubmit = document.getElementById('btn-submit-pin');
    _state.dom.dots = document.querySelectorAll('#modal-fast-pin .pin-dot');
};

// ==========================================================================
// 4. RENDERIZADO
// ==========================================================================
const _render = {

    // Rellena el selector con los empleados de cocina
    employeeSelect: (employees) => {
        _state.dom.select.textContent = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = 'Selecciona tu nombre...';
        _state.dom.select.appendChild(placeholder);

        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.employee_number || emp.employeeNumber || '';
            opt.textContent = `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim();
            _state.dom.select.appendChild(opt);
        });
    },

    // Actualiza los dots según los dígitos ingresados
    dots: () => {
        _state.dom.dots.forEach((dot, i) => {
            const filled = i < _state.pin.length;
            dot.classList.toggle('bg-amber-400', filled);
            dot.classList.toggle('border-amber-400', filled);
            dot.classList.toggle('border-slate-500', !filled);
        });
    },

    // Estado del botón submit
    submitBtn: () => {
        _state.dom.btnSubmit.disabled =
            _state.pin.length < PIN_LENGTH || !_state.dom.select.value;
    },

    // Feedback visual de éxito dentro del panel antes de cerrarlo
    successFeedback: (nombre) => {
        _state.dom.panel.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => {
            _state.dom.panel.classList.remove('ring-2', 'ring-emerald-400');
            _publicAPI.close();
        }, 1200);
    }
};

// ==========================================================================
// 5. LÓGICA DE NEGOCIO / DATOS
// ==========================================================================
const _logic = {

    // Carga empleados de cocina una sola vez al inicializar
    loadEmployees: async () => {
        try {
            const res = await fetchData(ENDPOINTS.admin.get.employees);
            const all = res.data || [];

            // Filtrar por área de cocina (case-insensitive sobre area_name)
            _state.employees = all.filter(emp => {
                const areaName = (emp.area_name || emp.areaName || '').toLowerCase();
                return areaName.includes('cocin');
            });

            // Si no hay coincidencias, mostrar todos los activos como fallback
            if (_state.employees.length === 0) {
                _state.employees = all.filter(e =>
                    e.is_active === true || e.isActive === true
                );
            }

            _render.employeeSelect(_state.employees);
        } catch (err) {
            console.error('[PinChecador] Error cargando empleados:', err);
            // Dejar el select con texto de error; el usuario puede reintentar
            if (_state.dom.select) {
                _state.dom.select.textContent = '';
                const opt = document.createElement('option');
                opt.value = '';
                opt.disabled = true;
                opt.selected = true;
                opt.textContent = 'Error al cargar — recarga la página';
                _state.dom.select.appendChild(opt);
            }
        }
    },

    // Agrega un dígito al PIN (máx 4)
    pushDigit: (digit) => {
        if (_state.pin.length >= PIN_LENGTH) return;
        _state.pin.push(digit);
        _render.dots();
        _render.submitBtn();
    },

    // Borra el último dígito
    popDigit: () => {
        _state.pin.pop();
        _render.dots();
        _render.submitBtn();
    },

    // Envía el checkin al servidor
    submit: async () => {
        const employeeNumber = _state.dom.select.value;
        const pin = _state.pin.join('');

        if (!employeeNumber || pin.length < PIN_LENGTH) return;

        _state.dom.btnSubmit.disabled = true;

        try {
            await postData(ENDPOINTS.kitchen.post.clockIn, { employeeNumber, pin });

            const nombre = _state.dom.select.options[_state.dom.select.selectedIndex]?.text || employeeNumber;
            showSuccessModal(`Entrada registrada para ${nombre}.`, '¡Bienvenido!');
            _render.successFeedback(nombre);
            _logic.resetPin();

        } catch (err) {
            showErrorModal(err.message || 'PIN incorrecto o empleado no encontrado.', 'Error de Entrada');
            _logic.resetPin();
        } finally {
            _render.submitBtn(); // re-evalúa disabled en caso de éxito
        }
    },

    // Limpia el PIN sin cerrar el panel
    resetPin: () => {
        _state.pin = [];
        _render.dots();
        _render.submitBtn();
    }
};

// ==========================================================================
// 6. EVENTOS  (se registran UNA vez en init())
// ==========================================================================
const _bindEvents = () => {
    // Cerrar panel
    _state.dom.btnClose.addEventListener('click', _publicAPI.close);

    // Delegación en el numpad — un solo listener para todos los botones
    _state.dom.numpad.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-numpad');
        if (!btn) return;

        const val = btn.getAttribute('data-val');
        if (val === 'clear') {
            _logic.popDigit();
        } else {
            _logic.pushDigit(val);
        }
    });

    // Re-evaluar submit cuando cambia el empleado seleccionado
    _state.dom.select.addEventListener('change', _render.submitBtn);

    // Confirmar con Enter desde teclado físico (tablets con teclado)
    _state.dom.panel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !_state.dom.btnSubmit.disabled) _logic.submit();
        if (e.key === 'Escape') _publicAPI.close();
    });

    // Submit
    _state.dom.btnSubmit.addEventListener('click', _logic.submit);
};

// ==========================================================================
// 7. API PÚBLICA
// ==========================================================================
const _publicAPI = {

    // Llamado UNA vez por app.js al arrancar
    init: async () => {
        _cacheDOM();
        _bindEvents();
        await _logic.loadEmployees();
    },

    // Llamado por app.js al recibir PubSub('OPEN_MODAL', 'pin-modal')
    open: () => {
        if (!_state.dom.panel) return;
        _logic.resetPin();
        _state.dom.panel.classList.remove('hidden');
        _state.dom.select.focus();
    },

    // Llamado internamente y por el botón ✕
    close: () => {
        if (!_state.dom.panel) return;
        _state.dom.panel.classList.add('hidden');
        _logic.resetPin();
    }
};

export const PinChecadorController = _publicAPI;