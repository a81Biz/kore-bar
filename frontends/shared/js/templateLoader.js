// frontends/shared/js/templateLoader.js

export const TemplateLoader = {
    /**
     * Carga archivos HTML parciales de forma asíncrona y los inyecta en el DOM.
     * @param {Array<string>} partialsList - Arreglo con los nombres de archivo desde el Modelo.
     * @param {string} basePath - Ruta base del micrositio (ej. '/admin').
     */
    async loadPartials(partialsList, basePath) {
        console.log(`[TemplateLoader] Inyectando ${partialsList.length} módulos parciales...`);

        const fetchPromises = partialsList.map(async (fileName) => {
            try {
                // Usamos la ruta configurada en Nginx que apunta a la carpeta del sitio
                const response = await fetch(`${basePath}/partials/${fileName}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const htmlString = await response.text();

                // Parseamos el string a DOM
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlString;

                // Extraemos todos los <template> del archivo y los mandamos al body principal
                const templates = tempDiv.querySelectorAll('template');
                templates.forEach(tpl => {
                    document.body.appendChild(tpl);
                });

            } catch (err) {
                console.error(`[TemplateLoader] Fallo crítico al cargar ${fileName}:`, err);
            }
        });

        // Esperamos a que TODAS las promesas (archivos) se descarguen e inyecten
        await Promise.all(fetchPromises);
        console.log('[TemplateLoader] Ecosistema de plantillas inyectado con éxito.');
    }
};