// frontends/admin/js/views/menu/index.js
import { CategoriasController } from './categorias.js';
import { PlatillosController } from './platillos.js';
import { PubSub } from '/shared/js/pubsub.js';

export const MenuController = {
    mount: async (container) => {
        // 1. Montar submódulos entregándoles el contenedor principal
        // (Como los IDs son únicos, cada controlador buscará su propia sección)
        await CategoriasController.mount(container);
        await PlatillosController.mount(container);

        // 2. Orquestar la comunicación (PubSub)
        // Cuando se añade, edita o borra una categoría, los platillos deben actualizar sus Selectores
        PubSub.subscribe('CATEGORIAS_ACTUALIZADAS', async () => {
            await PlatillosController.actualizarCategorias();
        });
    }
};