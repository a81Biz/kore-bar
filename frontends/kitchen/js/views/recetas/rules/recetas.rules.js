// ==========================================================================
// MOTOR DE REGLAS: INGENIERÍA DE MENÚ (COCINA)
// ==========================================================================

export const RecetasRules = {
    // R-FORMAT-REC-01: Estandarización de Códigos de Insumo
    code: {
        required: true,
        pattern: /^[A-Z0-9\-]+$/,
        message: 'El código solo puede contener letras mayúsculas, números y guiones (sin espacios. Ej. ING-TOMATE).'
    },

    // Reglas Básicas de Integridad
    name: {
        required: true,
        message: 'El nombre del insumo es obligatorio.'
    },
    unit: {
        required: true,
        message: 'Debes seleccionar una unidad de medida (KG, GR, L, ML, PZ).'
    },

    // R-FIN-REC-01: Control de Unidad Métrica
    qty: {
        required: true,
        custom: (value) => {
            const num = parseFloat(value);
            // Debe ser un número válido y estrictamente mayor a cero
            return !isNaN(num) && num > 0;
        },
        message: 'La cantidad para la receta debe ser un número estricto mayor a 0.'
    }
};