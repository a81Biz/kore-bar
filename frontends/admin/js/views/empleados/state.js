import { ValidatorEngine } from '/shared/js/validationEngine.js';
// OJO: Subimos dos niveles porque ahora estamos dentro de views/empleados/
import { EmpleadosValidationRules } from '../../rules/empleados.rules.js';

export const state = {
    datos: {
        empleados: [],
        puestosCatalog: {},
        syncStats: { saved: 0, pending: 0, orphan: 0 }
    },
    dom: {
        root: null, tbody: null, formSync: null, inputUrlSync: null, btnSync: null,
        modalEdit: null, formEdit: null, inputEditId: null, inputEditNombre: null,
        inputEditApellidos: null, selectEditArea: null, selectEditPuesto: null,
        checkEditActive: null, btnSubmitEdit: null,
        statsContainer: null, statSaved: null, statPending: null, statOrphan: null,
        btnSaveAll: null, statPendingBtn: null
    },
    motorValidacion: new ValidatorEngine(EmpleadosValidationRules),
    uiConfig: {
        badges: {
            areas: {
                'GERENCIA': 'bg-blue-100 text-blue-800',
                'PISO': 'bg-emerald-100 text-emerald-800',
                'COCINA': 'bg-orange-100 text-orange-800',
                'CAJA': 'bg-purple-100 text-purple-800',
                'DEFAULT': 'bg-slate-100 text-slate-800 border border-slate-200'
            },
            estados: {
                activo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                inactivo: 'bg-red-100 text-red-700 border-red-200'
            },
            mdm: {
                'saved': { color: 'bg-green-100 text-green-800 border-green-200', icon: '✓', label: 'Al Día' },
                'pending': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⚠️', label: 'Falta Guardar' },
                'orphan': { color: 'bg-red-100 text-red-800 border-red-200', icon: '🗑️', label: 'Huérfano / Baja' }
            }
        }
    }
};