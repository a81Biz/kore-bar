// waiters/js/views/login.js
import { PubSub } from '/shared/js/pubsub.js';
import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showErrorModal } from '/shared/js/ui.js';

export async function mount(container) {
    let pinCode = '';
    let selectedEmployee = null;
    let eligibleWaiters = [];

    const employeeSelect = container.querySelector('#employee-select');
    const pinPadButtons = container.querySelectorAll('#pin-pad button');
    const pinDots = container.querySelectorAll('.pin-dot');

    // ── Cargar empleados elegibles para el POS ────────────────────────────
    try {
        const res = await fetchData(ENDPOINTS.waiters.get.waiters);
        if (res.success && res.data) {
            eligibleWaiters = res.data;
            res.data.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.employee_number;
                option.textContent = emp.nombre.trim();
                employeeSelect.appendChild(option);
            });
        }
    } catch (err) {
        console.error('[Login] Error cargando empleados:', err);
    }

    // ── Control del PIN ───────────────────────────────────────────────────
    employeeSelect.addEventListener('change', (e) => {
        selectedEmployee = e.target.value;
        pinCode = '';
        updateDots();
    });

    const updateDots = () => {
        pinDots.forEach((dot, i) => {
            const filled = i < pinCode.length;
            dot.classList.toggle('bg-primary', filled);
            dot.classList.toggle('border-primary', filled);
            dot.classList.toggle('bg-transparent', !filled);
            dot.classList.toggle('border-slate-300', !filled);
            dot.classList.toggle('dark:border-slate-600', !filled);
        });
    };

    pinPadButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!selectedEmployee) {
                showErrorModal('Por favor, seleccione su nombre primero.');
                return;
            }

            const val = e.currentTarget.getAttribute('data-val');

            if (val === 'del') {
                pinCode = pinCode.slice(0, -1);
                updateDots();
                return;
            }

            if (pinCode.length >= 4) return;
            pinCode += val;
            updateDots();

            if (pinCode.length === 4) {
                try {
                    const res = await postData(ENDPOINTS.waiters.post.login, {
                        employeeNumber: selectedEmployee,
                        context: 'waiter',
                        pinCode
                    });

                    if (res.success) {
                        const fullData = eligibleWaiters.find(w => w.employee_number === selectedEmployee) || {};
                        localStorage.setItem('pos_token', res.data.body.token);
                        PubSub.publish('AUTH_SUCCESS', {
                            employeeNumber: res.data.body?.employeeNumber || fullData.employee_number,
                            name: res.data.body?.name || fullData.nombre,
                            shift: fullData.shift,
                            zona: fullData.zona,
                            role: res.data.body?.role || 'WAITERS'
                        });
                    }
                } catch (err) {
                    showErrorModal(err.message || 'Código PIN incorrecto o inválido.');
                    pinCode = '';
                    updateDots();
                }
            }
        });
    });
}