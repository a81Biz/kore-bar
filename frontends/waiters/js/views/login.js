// waiters/js/views/login.js
import { PubSub } from '/shared/js/pubsub.js';
import { fetchData, postData } from '/shared/js/http.client.js';
import { ENDPOINTS } from '/shared/js/endpoints.js';
import { showErrorModal } from '/shared/js/ui.js';

export async function mount(container) {
    let pinCode = '';
    let selectedEmployee = null;

    const employeeSelect = container.querySelector('#employee-select');
    const pinPadButtons = container.querySelectorAll('#pin-pad button');
    const pinDots = container.querySelectorAll('.pin-dot');

    // ── Cargar empleados elegibles para el POS ────────────────────────────
    try {
        const res = await fetchData(ENDPOINTS.waiters.get.waiters);
        if (res.success && res.data) {
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
                        PubSub.publish('AUTH_SUCCESS', {
                            employeeNumber: res.data.body.employeeNumber,
                            name: res.data.body.name,
                            role: res.data.body.role
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