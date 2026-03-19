const MDM_DECISION_MATRIX = {
    // FORMATO DE LLAVE: "ACCION_HR | ESTADO_BD | FECHA"

    // 1. Escenarios de Alta (Nuevos o Actualizaciones)
    "ALTA|NULL|NEWER": { action: "CREATE", syncState: "pending", log: "Nuevo Ingreso. Se creará registro." },
    "ALTA|ACTIVO|NEWER": { action: "UPDATE", syncState: "pending", log: "Actualización. HR mandó datos más recientes." },
    "ALTA|ACTIVO|SAME": { action: "IGNORE", syncState: "saved", log: "Al día. Fechas idénticas." },
    "ALTA|ACTIVO|OLDER": { action: "REJECT", syncState: "error", log: "Bloqueado (EMP-04). Payload HR es más viejo que BD local." },

    // 2. Escenarios de Reingreso (Estaba de baja y HR manda alta)
    "ALTA|INACTIVO|NEWER": { action: "REACTIVATE", syncState: "pending", log: "Reingreso. Estaba inactivo, HR mandó nueva alta." },
    "ALTA|INACTIVO|SAME": { action: "IGNORE", syncState: "saved", log: "Baja Mantenida. La fecha de alta coincide con su registro inactivo." },
    "ALTA|INACTIVO|OLDER": { action: "REJECT", syncState: "error", log: "Reingreso Inválido. Fecha HR es más antigua que la BD." },

    // 3. Escenarios de Baja explícita por HR
    "BAJA|ACTIVO|NEWER": { action: "DEACTIVATE", syncState: "pending", log: "Baja solicitada por HR." },
    "BAJA|ACTIVO|SAME": { action: "DEACTIVATE", syncState: "pending", log: "Baja solicitada por HR." },
    "BAJA|INACTIVO|ANY": { action: "IGNORE", syncState: "saved", log: "Ya estaba inactivo localmente." },
    "BAJA|NULL|ANY": { action: "REJECT", syncState: "error", log: "Baja bloqueada. El empleado no existe localmente." },

    // 4. Escenarios de Omisión (HR no mandó el registro en el JSON actual)
    "NONE|ACTIVO|ANY": { action: "FLAG", syncState: "orphan", log: "Huérfano. Activo localmente pero no vino en el archivo HR." },
    "NONE|INACTIVO|ANY": { action: "IGNORE", syncState: "saved", log: "Inactivo histórico." }
};

export const MDMEngine = {
    /**
     * Evalúa el escenario y devuelve la decisión de sincronización.
     * @param {Object|null} hrEmp - El objeto del empleado parseado desde el JSON de RRHH.
     * @param {Object|null} dbEmp - El objeto del empleado como existe actualmente en Base de Datos.
     * @returns {Object} { action, syncState, log }
     */
    evaluate: (hrEmp, dbEmp) => {
        // 1. Determinar Acción HR
        let hrAction = 'NONE';
        if (hrEmp) {
            hrAction = (hrEmp.action === 'baja') ? 'BAJA' : 'ALTA';
        }

        // 2. Determinar Estado BD
        let dbState = 'NULL';
        if (dbEmp) {
            dbState = dbEmp.is_active ? 'ACTIVO' : 'INACTIVO';
        }

        // 3. Determinar Comparación de Fechas
        let dateComp = 'ANY';
        if (hrEmp && dbEmp) {
            const getSafeTime = (val) => {
                if (!val) return new Date('1900-01-01').getTime();
                const d = new Date(val);
                return isNaN(d.getTime()) ? new Date('1900-01-01').getTime() : d.getTime();
            };

            // Intentamos leer del objeto mapeado o del crudo
            const hrDate = getSafeTime(hrEmp.hire_date || hrEmp.fecha_llegada);
            const dbDate = getSafeTime(dbEmp.hire_date || dbEmp.hireDate);

            if (hrDate > dbDate) dateComp = 'NEWER';
            else if (hrDate < dbDate) dateComp = 'OLDER';
            else dateComp = 'SAME';
        } else if (hrEmp && !dbEmp) {
            dateComp = 'NEWER'; // Algo nuevo siempre le gana a "nada"
        }

        // 4. Armar la Llave Maestra
        const evaluationKey = `${hrAction}|${dbState}|${dateComp}`;
        const fallbackKey = `${hrAction}|${dbState}|ANY`;

        // 5. Consultar la Matriz
        const decision = MDM_DECISION_MATRIX[evaluationKey] || MDM_DECISION_MATRIX[fallbackKey];

        if (!decision) {
            console.warn(`[MDM Engine] Casuística no mapeada en la Matriz de la Verdad: ${evaluationKey}`);
            return { action: "UNKNOWN", syncState: "error", log: `Matriz falló para la llave: ${evaluationKey}` };
        }

        return decision;
    }
};