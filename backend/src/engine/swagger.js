import fs from 'fs';
import path from 'path';
import { RouteRegistry } from './route-registry.js';


const getAllSchemaFiles = (dir, fileList = []) => {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllSchemaFiles(filePath, fileList);
        } else if (file.endsWith('.schema.json')) {
            fileList.push(filePath);
        }
    }
    return fileList;
};

export const generateOpenAPISpec = () => {
    const schemasDir = path.resolve(process.cwd(), 'src/engine/schemas');
    let files = [];

    try {
        files = getAllSchemaFiles(schemasDir);
    } catch (e) {
        console.warn('[Swagger] No se encontró la carpeta de esquemas o está vacía.');
    }

    const paths = {};

    files.forEach(filePath => {
        const schema = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        if (!schema.api || !schema.api.path || !schema.api.method) return;

        // Derivar el prefijo a partir de la subcarpeta donde vive el schema
        // Ej: .../schemas/cashier/cashier-login.schema.json → subDir = 'cashier'
        const relativeToSchemas = path.relative(schemasDir, filePath);
        const subDir = relativeToSchemas.split(path.sep)[0];
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