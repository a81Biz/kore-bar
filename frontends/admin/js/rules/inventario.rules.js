import { ValidationChain } from '/shared/js/validation.constants.js';

export const SupplierRules = {
    context: 'Alta de Proveedores',
    order: ['code', 'name'],
    rules: {
        code: {
            priority: ValidationChain.PRIORITIES.CRITICAL,
            stopOnFail: true,
            validate: (payload) => {
                const regex = /^[A-Z0-9\-]+$/;
                if (!regex.test(payload.code)) {
                    return { passed: false, error: 'El código solo puede contener letras mayúsculas, números y guiones (Ej. PROV-01).' };
                }
                return { passed: true };
            }
        },
        name: {
            priority: ValidationChain.PRIORITIES.HIGH,
            stopOnFail: true,
            validate: (payload) => {
                if (!payload.name || payload.name.trim() === '') {
                    return { passed: false, error: 'La razón social del proveedor es obligatoria.' };
                }
                return { passed: true };
            }
        }
    }
};

export const AdjustRules = {
    context: 'Ajuste de Inventario Físico',
    order: ['transactionType', 'quantity', 'reference'],
    rules: {
        transactionType: {
            priority: ValidationChain.PRIORITIES.CRITICAL,
            stopOnFail: true,
            validate: (payload) => {
                if (!['IN', 'OUT', 'ADJ'].includes(payload.transactionType)) {
                    return { passed: false, error: 'Tipo de transacción inválido.' };
                }
                return { passed: true };
            }
        },
        quantity: {
            priority: ValidationChain.PRIORITIES.HIGH,
            stopOnFail: true,
            validate: (payload) => {
                const qty = parseFloat(payload.quantity);
                if (isNaN(qty) || qty <= 0) {
                    return { passed: false, error: 'La cantidad debe ser un número mayor a cero.' };
                }
                // R-FIN-INV-02: Bloqueo de Stock Negativo (Memoria)
                if ((payload.transactionType === 'OUT' || payload.transactionType === 'ADJ') && qty > payload.currentStock) {
                    return { passed: false, error: `No puedes descontar ${qty}. El stock actual es de solo ${payload.currentStock}.` };
                }
                return { passed: true };
            }
        },
        reference: {
            priority: ValidationChain.PRIORITIES.LOW,
            stopOnFail: false,
            validate: (payload) => {
                if (!payload.reference || payload.reference.trim() === '') {
                    return { passed: false, error: 'Se recomienda agregar un motivo para el historial.' };
                }
                return { passed: true };
            }
        }
    }
};

export const SupplierPriceRules = {
    context: 'Vinculación de Costo Proveedor',
    order: ['itemCode', 'itemName', 'price'],
    rules: {
        itemCode: {
            priority: ValidationChain.PRIORITIES.CRITICAL,
            stopOnFail: true,
            validate: (payload) => {
                const regex = /^[A-Z0-9\-]+$/;
                if (!payload.itemCode || !regex.test(payload.itemCode)) {
                    return { passed: false, error: 'El código solo puede contener mayúsculas, números y guiones.' };
                }
                return { passed: true };
            }
        },
        itemName: {
            priority: ValidationChain.PRIORITIES.HIGH,
            stopOnFail: true,
            validate: (payload) => {
                if (!payload.itemName || payload.itemName.trim().length < 3) {
                    return { passed: false, error: 'El nombre y unidad son obligatorios (Mín. 3 caracteres).' };
                }
                return { passed: true };
            }
        },
        price: {
            priority: ValidationChain.PRIORITIES.CRITICAL,
            stopOnFail: true,
            validate: (payload) => {
                const price = parseFloat(payload.price);
                if (isNaN(price) || price <= 0) {
                    return { passed: false, error: 'El costo pactado debe ser mayor a $0.00' };
                }
                return { passed: true };
            }
        }
    }
};