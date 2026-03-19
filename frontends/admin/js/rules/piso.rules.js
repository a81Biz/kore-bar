// frontends/admin/js/rules/piso.rules.js
import { ValidationChain } from '/shared/js/validation.constants.js';

export const PisoValidationRules = {
    context: 'GestionPiso',

    // Orden explícito de ejecución
    order: [
        'formatoMesa',
        'mesaDuplicada',
        'fechaPasada',
        'colisionTurnos'
    ],

    rules: {
        formatoMesa: {
            priority: ValidationChain.PRIORITIES.MEDIUM,
            stopOnFail: true,
            description: 'Validar que el ID (alfanumérico) y la capacidad de la mesa sean correctos',
            validate: (payload) => {
                if (payload.action !== 'CREATE_TABLE') return { passed: true };

                // Permitimos ID string (Ej. T-01, MESA-5, etc)
                const idValido = typeof payload.numero === 'string' && payload.numero.trim() !== '';
                const capacidadValida = !isNaN(payload.capacidad) && payload.capacidad > 0;

                return {
                    passed: idValido && capacidadValida,
                    error: (idValido && capacidadValida) ? null : 'El ID de la mesa no puede estar vacío y la capacidad debe ser numérica mayor a cero.'
                };
            }
        },

        mesaDuplicada: {
            priority: ValidationChain.PRIORITIES.CRITICAL,
            stopOnFail: true,
            description: 'Validar unicidad del número de mesa en memoria',
            validate: (payload, state) => {
                if (payload.action !== 'CREATE_TABLE') return { passed: true };

                const existe = state.tables.some(t => String(t.number) === String(payload.numero));
                return {
                    passed: !existe,
                    error: existe ? `La mesa #${payload.numero} ya se encuentra registrada en otra zona.` : null
                };
            }
        },

        fechaPasada: {
            priority: ValidationChain.PRIORITIES.HIGH,
            stopOnFail: true,
            description: 'Bloqueo del Pasado: Impide asignar turnos en días anteriores a hoy',
            validate: (payload) => {
                if (payload.action !== 'CREATE_ASSIGNMENT') return { passed: true };

                // Normalizamos la fecha actual a las 00:00:00 local
                const hoy = new Date();
                hoy.setHours(0, 0, 0, 0);

                // La fecha viene en formato YYYY-MM-DD
                const [year, month, day] = payload.date.split('-');
                const fechaElegida = new Date(year, month - 1, day);
                fechaElegida.setHours(0, 0, 0, 0);

                const esPasado = fechaElegida < hoy;
                return {
                    passed: !esPasado,
                    error: esPasado ? 'No puedes agendar asignaciones en fechas pasadas.' : null
                };
            }
        },

        colisionTurnos: {
            priority: ValidationChain.PRIORITIES.HIGH,
            stopOnFail: true,
            description: 'Anti-Colisión: Un mesero no puede estar en dos zonas distintas en el mismo turno',
            validate: (payload, state) => {
                if (payload.action !== 'CREATE_ASSIGNMENT') return { passed: true };

                const empalme = state.assignments.some(a =>
                    String(a.waiterId) === String(payload.waiterId) && a.shift === payload.shift
                );

                return {
                    passed: !empalme,
                    error: empalme ? 'El mesero ya tiene una zona asignada en este mismo turno.' : null
                };
            }
        }
    }
};