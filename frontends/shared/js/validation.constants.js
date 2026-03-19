// frontends/shared/js/validation.constants.js

export const ValidationChain = {
    // Definir prioridades como constantes globales
    PRIORITIES: {
        CRITICAL: 1000,  // Seguridad, integridad de BD (Ej. Duplicados)
        HIGH: 800,       // Reglas de negocio principales (Ej. Empalmes)
        MEDIUM: 500,     // Validaciones de formato y lógica secundaria
        LOW: 200,        // Validaciones cosméticas
    }
};