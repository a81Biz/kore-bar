import { ValidationChain } from '/shared/js/validation.constants.js';

export const EmpleadosValidationRules = {
    context: 'GestionEmpleados',

    // Se eliminó 'reconciliacionHR' porque ahora lo maneja el MDMEngine
    order: [
        'urlSyncValida',
        'integridadDatosHR',
        'datosEdicionCompletos'
    ],

    rules: {
        urlSyncValida: {
            priority: ValidationChain.PRIORITIES.MEDIUM,
            stopOnFail: true,
            description: 'Validar que la URL de sincronización no esté vacía',
            validate: (payload) => {
                if (payload.action !== 'SYNC_HR') return { passed: true };
                const hasUrl = typeof payload.targetUrl === 'string' && payload.targetUrl.trim().length > 0;
                return { passed: hasUrl, error: hasUrl ? null : 'La URL del JSON es obligatoria.' };
            }
        },

        integridadDatosHR: {
            priority: ValidationChain.PRIORITIES.CRITICAL,
            stopOnFail: true,
            description: 'Validar que el registro tenga datos vitales (EMP-06)',
            validate: (payload) => {
                if (payload.action !== 'RECONCILE_EMPLOYEE') return { passed: true };
                const { empJson } = payload;

                if (!empJson.employee_number || String(empJson.employee_number).trim() === '') {
                    return { passed: false, error: 'Fila ignorada: Falta el ID de Empleado (EMP-06).' };
                }

                if (!empJson.first_name || String(empJson.first_name).trim() === '') {
                    return { passed: false, error: `Fila ignorada: El ID ${empJson.employee_number} no tiene nombre (EMP-06).` };
                }

                return { passed: true };
            }
        },

        datosEdicionCompletos: {
            priority: ValidationChain.PRIORITIES.CRITICAL,
            stopOnFail: true,
            description: 'Asegurar mapeo completo antes de enviar a BD',
            validate: (payload) => {
                if (payload.action !== 'SAVE_EMPLOYEE') return { passed: true };
                const valido = payload.nombre && payload.apellidos && payload.codigo_area && payload.codigo_puesto;
                return { passed: !!valido, error: valido ? null : 'Asigna un Área y Puesto antes de guardar en BD.' };
            }
        }
    }
};