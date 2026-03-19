// frontends/shared/js/validationEngine.js

export class ValidatorEngine {
    constructor(rulesConfig) {
        this.config = rulesConfig;
    }

    /**
     * Ejecuta el pipeline de validación.
     * @param {Object} payload - Los datos nuevos ingresados por el usuario.
     * @param {Object} state - El estado actual de la memoria (BD local).
     * @returns {Object} - { isValid: boolean, error: string|null, logs: Array }
     */
    execute(payload, state = {}) {
        const logs = [];

        console.log(`[ValidatorEngine] Iniciando cadena de validación: ${this.config.context}`);

        for (const ruleName of this.config.order) {
            const rule = this.config.rules[ruleName];
            if (!rule) continue;

            // Ejecutar la función de validación inyectando payload y estado
            const result = rule.validate(payload, state);

            logs.push({
                rule: ruleName,
                priority: rule.priority,
                passed: result.passed,
                error: result.error || null
            });

            if (!result.passed && rule.stopOnFail) {
                console.warn(`[ValidatorEngine] 🛑 Cadena rota en [${ruleName}]: ${result.error}`);
                return { isValid: false, error: result.error, logs };
            }
        }

        console.log(`[ValidatorEngine] ✅ Validación superada (${logs.length} reglas)`);
        return { isValid: true, error: null, logs };
    }
}