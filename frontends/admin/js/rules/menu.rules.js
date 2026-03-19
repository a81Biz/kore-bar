import { ValidationChain } from '/shared/js/validation.constants.js';

export const MenuValidationRules = {
    context: 'GestionMenu',

    order: [
        'formatoCodigo',
        'precioPlatillo',
        'codigoDuplicado'
    ],

    rules: {
        formatoCodigo: {
            priority: ValidationChain.PRIORITIES.HIGH,
            stopOnFail: true,
            description: 'Validar que los códigos no tengan espacios y sean alfanuméricos con guiones',
            validate: (payload) => {
                if (!['CREATE_CATEGORY', 'CREATE_DISH'].includes(payload.action)) return { passed: true };

                // Expresión regular: Solo letras, números y guiones. Sin espacios.
                const regex = /^[A-Z0-9\-]+$/;
                const codigoValido = regex.test(payload.code);

                return {
                    passed: codigoValido,
                    error: codigoValido ? null : 'El código solo puede contener letras mayúsculas, números y guiones (sin espacios).'
                };
            }
        },

        precioPlatillo: {
            priority: ValidationChain.PRIORITIES.HIGH,
            stopOnFail: true,
            description: 'Validar que el precio del platillo sea un número positivo',
            validate: (payload) => {
                if (payload.action !== 'CREATE_DISH') return { passed: true };

                const precioValido = !isNaN(payload.price) && parseFloat(payload.price) >= 0;
                return {
                    passed: precioValido,
                    error: precioValido ? null : 'El precio del platillo debe ser un número mayor o igual a cero.'
                };
            }
        },

        codigoDuplicado: {
            priority: ValidationChain.PRIORITIES.MEDIUM,
            stopOnFail: true,
            description: 'Evitar colisiones de códigos en memoria antes de ir a BD',
            validate: (payload, state) => {
                // Validación para CU-MENU-01
                if (payload.action === 'CREATE_CATEGORY') {
                    const existe = state.categories && state.categories.some(c => c.categoryCode === payload.code);
                    return { passed: !existe, error: existe ? 'El código de categoría ya existe.' : null };
                }
                // Validación para CU-MENU-02
                if (payload.action === 'CREATE_DISH') {
                    const existe = state.dishes && state.dishes.some(d => d.dishCode === payload.code);
                    return { passed: !existe, error: existe ? 'El código del platillo ya existe.' : null };
                }
                return { passed: true };
            }
        }
    }
};