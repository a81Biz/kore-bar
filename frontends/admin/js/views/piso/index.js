import { ZonasController } from './zonas.js';
import { MesasController } from './mesas.js';
import { AsignacionesController } from './asignaciones.js';
import { PubSub } from '/shared/js/pubsub.js';

let _relojInterval = null;

const _iniciarReloj = (container) => {
    const elFecha = container.querySelector('#piso-fecha-actual');
    const elHora = container.querySelector('#piso-reloj-actual');

    if (!elFecha || !elHora) return;

    const actualizar = () => {
        const ahora = new Date();
        const opcionesFecha = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

        elFecha.textContent = ahora.toLocaleDateString('es-MX', opcionesFecha);
        elHora.textContent = ahora.toLocaleTimeString('es-MX', { hour12: false });
    };

    actualizar();
    if (_relojInterval) clearInterval(_relojInterval);
    _relojInterval = setInterval(actualizar, 1000);
};

export const PisoController = {
    mount: async (container) => {
        _iniciarReloj(container);

        // Montamos los 3 submódulos
        await Promise.all([
            ZonasController.mount(container),
            MesasController.mount(container),
            AsignacionesController.mount(container)
        ]);

        // Inyección inicial
        const zonasActuales = ZonasController.getZonas();
        MesasController.actualizarZonas(zonasActuales);
        AsignacionesController.actualizarZonas(zonasActuales);

        // Escuchamos actualizaciones globales
        PubSub.subscribe('ZONAS_ACTUALIZADAS', (zonas) => {
            MesasController.actualizarZonas(zonas);
            AsignacionesController.actualizarZonas(zonas);
        });

        // 🟢 NUEVO: Cuando cambian las mesas, avisamos a Asignaciones para recalcular el PAX del Resumen
        PubSub.subscribe('MESAS_ACTUALIZADAS', (mesas) => {
            AsignacionesController.actualizarMesas(mesas);
        });
    }
};