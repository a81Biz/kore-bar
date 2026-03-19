// waiters/js/views/login.js
import { PubSub } from '/shared/js/pubsub.js';
import { showSuccessModal, showErrorModal, confirmAction } from '/shared/js/ui.js';

/**
 * Controller mapping behaviors onto the `tpl-login` context logic.
 */
export async function mount(container) {
    let pin = "";
    let selectedEmployee = null;

    // Load necessary dependencies
    const { ENDPOINTS } = await import('/shared/js/endpoints.js');
    const { fetchData, postData } = await import('/shared/js/http.client.js');

    // HTML Targets
    const employeeSelect = container.querySelector('#employee-select');
    const pinPadButtons = container.querySelectorAll('#pin-pad button');
    const pinDots = container.querySelectorAll('.pin-dot');

    // 1. Fetch available employees natively
    try {
        const res = await fetchData(ENDPOINTS.admin.get.employees);
        if (res.success && res.data) {
            res.data.forEach(emp => {
                if (emp.is_active && emp.system_role === 'Mesero' || emp.system_role === 'Administrador') { // Waiters or admins can login
                    const option = document.createElement('option');
                    option.value = emp.employee_number;
                    option.textContent = `${emp.first_name} ${emp.last_name || ''}`;
                    employeeSelect.appendChild(option);
                }
            });
        }
    } catch (err) {
        console.error("Failed loading employees for POS login:", err);
    }

    employeeSelect.addEventListener('change', (e) => {
        selectedEmployee = e.target.value;
        pin = ""; // reset PIN
        updateDots();
    });

    const updateDots = () => {
        pinDots.forEach((dot, index) => {
            if (index < pin.length) {
                dot.classList.add('bg-primary', 'border-primary');
                dot.classList.remove('bg-transparent', 'border-slate-300', 'dark:border-slate-600');
            } else {
                dot.classList.remove('bg-primary', 'border-primary');
                dot.classList.add('bg-transparent', 'border-slate-300', 'dark:border-slate-600');
            }
        });
    };

    pinPadButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!selectedEmployee) {
                showErrorModal("Por favor, seleccione su nombre primero.");
                return;
            }

            const val = e.currentTarget.getAttribute('data-val');

            if (val === 'del') {
                pin = pin.slice(0, -1);
                updateDots();
            } else if (pin.length < 4) {
                pin += val;
                updateDots();

                if (pin.length === 4) {
                    try {
                        const payload = {
                            employeeNumber: selectedEmployee,
                            pin: pin
                        };
                        const res = await postData(ENDPOINTS.waiters.post.login, payload);

                        if (res.success) {
                            PubSub.publish('AUTH_SUCCESS', {
                                employeeNumber: res.data.body.employeeNumber,
                                name: res.data.body.name,
                                role: res.data.body.role
                            });
                        }
                    } catch (err) {
                        showErrorModal(err.message || 'Código PIN incorrecto o inválido.');
                        pin = "";
                        updateDots();
                    }
                }
            }
        });
    });
}
