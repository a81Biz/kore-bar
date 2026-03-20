// ============================================================
// swagger.js
// Genera la spec OpenAPI 3.0 desde el registro estático de schemas.
//
// MIGRACIÓN Workers: eliminados fs, path y getAllSchemaFiles.
// Se importa allSchemas desde schema-registry.js que esbuild
// resuelve en tiempo de compilación.
// ============================================================

import { RouteRegistry } from './route-registry.js';
import { allSchemas } from './schema-registry.js';

export const generateOpenAPISpec = () => {
    const paths = {};

    allSchemas.forEach(({ schema, subDir }) => {
        if (!schema.api || !schema.api.path || !schema.api.method) return;

        // Derivar el prefijo HTTP desde el RouteRegistry usando el subDir del registro
        const prefix = RouteRegistry[subDir] ?? `/api/${subDir}`;
        const method = schema.api.method.toLowerCase();
        const openApiPath = prefix + schema.api.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

        if (!paths[openApiPath]) paths[openApiPath] = {};

        const pathParams = [...schema.api.path.matchAll(/:([a-zA-Z0-9_]+)/g)].map(match => ({
            name: match[1],
            in: 'path',
            required: true,
            schema: { type: 'string' }
        }));

        let requestBody = undefined;
        if (['post', 'put', 'patch'].includes(method) && schema.api.body) {
            requestBody = {
                description: 'Payload esperado para este Workflow',
                required: true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: schema.api.body.properties || {},
                            required: schema.api.body.required || []
                        }
                    }
                }
            };
        }

        paths[openApiPath][method] = {
            summary: schema.name || schema.id,
            description: schema.description || `Workflow autogenerado: ${schema.id}`,
            tags: schema.api.tags || ['General'],
            parameters: pathParams,
            requestBody,
            responses: {
                '200': { description: 'Ejecución exitosa del Workflow' },
                '400': { description: 'Error de validación o Regla de Negocio (AppError)' },
                '500': { description: 'Error interno del servidor (Database)' }
            }
        };
    });

    return {
        openapi: '3.0.0',
        info: {
            title: 'Kore Bar OS API',
            version: '1.0.0',
            description: 'Documentación dinámica auto-generada desde los esquemas del Workflow Engine.'
        },
        paths
    };
};