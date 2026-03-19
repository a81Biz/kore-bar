import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeWorkflow } from './orchestrator.js';
import { buildAuthMiddleware } from '../middleware/auth.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemasDir = path.join(__dirname, 'schemas');

// ── Explorador recursivo de schemas ──────────────────────────
const getAllSchemaFiles = (dir, fileList = []) => {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllSchemaFiles(filePath, fileList);
        } else if (file.endsWith('.schema.json')) {
            // Solo .schema.json — evita cargar package.json u otros .json del proyecto
            fileList.push(filePath);
        }
    }
    return fileList;
};

/**
 * Construye y registra rutas Hono dinámicamente desde los schemas JSON.
 * @param {import('hono').Hono} router  - Router Hono donde se montarán las rutas
 * @param {string}              subDir  - Subcarpeta de schemas a cargar (ej: 'admin', 'cashier')
 */
export const buildRoutes = (router, subDir = '') => {
    const targetDir = subDir
        ? path.join(schemasDir, subDir)
        : schemasDir;

    const files = getAllSchemaFiles(targetDir);

    files.forEach(schemaPath => {
        let schema;
        try {
            schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        } catch (e) {
            console.error(`[SchemaRouter] Failed to parse schema ${schemaPath}:`, e);
            return;
        }

        if (!schema.api?.method || !schema.api?.path) return;

        const method = schema.api.method.toLowerCase();
        const routePath = schema.api.path;

        console.log(`[SchemaRouter] Registering ${method.toUpperCase()} ${routePath} -> Workflow: ${schema.name || schema.id}`);

        // ── Auth middleware derivado del schema ───────────────
        const authMiddleware = buildAuthMiddleware(schema.api.auth);

        // ── Montaje de la ruta HTTP ───────────────────────────
        router[method](routePath, authMiddleware, async (c) => {
            try {
                const params = c.req.param() || {};
                const queries = c.req.query() || {};
                let sanitizedBody = {};

                // ── Gatekeeper: solo para métodos con body ────
                if (['POST', 'PUT', 'PATCH'].includes(schema.api.method.toUpperCase())) {
                    const body = await c.req.json().catch(() => ({}));

                    if (schema.api.body) {
                        const { required = [], properties = {} } = schema.api.body;

                        // Validar campos requeridos
                        const missing = required.filter(field =>
                            body[field] === undefined || body[field] === null || body[field] === ''
                        );
                        if (missing.length > 0) {
                            return c.json({
                                success: false,
                                error: `Faltan campos requeridos: ${missing.join(', ')}`
                            }, 400);
                        }

                        // Validar tipos y sanitizar
                        for (const [key, propDef] of Object.entries(properties)) {
                            const val = body[key];
                            if (val !== undefined && val !== null) {
                                if (propDef.type === 'boolean' && typeof val !== 'boolean') {
                                    return c.json({ success: false, error: `El campo '${key}' debe ser booleano.` }, 400);
                                }
                                if (propDef.type === 'string' && typeof val !== 'string') {
                                    return c.json({ success: false, error: `El campo '${key}' debe ser texto.` }, 400);
                                }
                                if (propDef.type === 'integer' && typeof val !== 'number') {
                                    return c.json({ success: false, error: `El campo '${key}' debe ser numérico entero.` }, 400);
                                }
                                if (propDef.type === 'array' && !Array.isArray(val)) {
                                    return c.json({ success: false, error: `El campo '${key}' debe ser un arreglo.` }, 400);
                                }
                                if (propDef.type === 'object' && (typeof val !== 'object' || Array.isArray(val))) {
                                    return c.json({ success: false, error: `El campo '${key}' debe ser un objeto.` }, 400);
                                }
                                sanitizedBody[key] = val;
                            } else if (propDef.default !== undefined) {
                                sanitizedBody[key] = propDef.default;
                            }
                        }
                    } else {
                        // Zero Trust: si el schema no define body, no se acepta ninguno
                        if (Object.keys(body).length > 0) {
                            console.warn(`[Seguridad] Intento de inyección de payload en: ${routePath}`);
                            return c.json({
                                success: false,
                                error: 'Bad Request: Este endpoint no acepta un cuerpo (body) en la petición.'
                            }, 400);
                        }
                    }
                }

                // ── Construir estado inicial del workflow ─────
                // FIX: los query params se incluyen en payload para que
                // los helpers los lean desde state.payload (ej: ?location=LOC-COCINA)
                const initialState = {
                    caller: 'schema_router',
                    payload: { ...queries, ...sanitizedBody },
                    params
                };

                const finalState = await executeWorkflow(schema, initialState, c);

                if (finalState.status === 'FAILED') {
                    return c.json({ success: false, error: 'Workflow execution failed.' }, 400);
                }

                // ── Interpolación Handlebars para respuestas SSOT ──
                let responseData = finalState.data || finalState.response || finalState;

                if (finalState.response?.body) {
                    const interpolate = (obj) => {
                        if (typeof obj === 'string') {
                            // Match exacto → reemplaza el string completo por el valor (soporta objetos/arrays)
                            const exactMatch = obj.match(/^\{\{state\.([a-zA-Z0-9_.]+)\}\}$/);
                            if (exactMatch) {
                                const val = exactMatch[1].split('.').reduce((acc, k) => acc?.[k], finalState);
                                return val !== undefined ? val : obj;
                            }
                            // Match parcial → reemplaza dentro del string
                            return obj.replace(/\{\{state\.([a-zA-Z0-9_.]+)\}\}/g, (match, keyPath) => {
                                const val = keyPath.split('.').reduce((acc, k) => acc?.[k], finalState);
                                return val !== undefined ? val : match;
                            });
                        }
                        if (Array.isArray(obj)) return obj.map(interpolate);
                        if (obj !== null && typeof obj === 'object') {
                            return Object.fromEntries(
                                Object.entries(obj).map(([k, v]) => [k, interpolate(v)])
                            );
                        }
                        return obj;
                    };
                    responseData.body = interpolate(finalState.response.body);
                }

                return c.json({
                    success: true,
                    message: finalState.message || 'Success',
                    data: finalState.data || responseData
                }, 200);

            } catch (error) {
                console.error(`[SchemaRouter] Execution Failed for ${routePath}:`, error);
                const status = error.statusCode || 500;
                if (error.isOperational) {
                    return c.json({ success: false, error: error.message }, status);
                }
                return c.json({
                    success: false,
                    error: error.message || 'Internal Server Error',
                    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
                }, status);
            }
        });
    });

    console.log(`[SchemaRouter] Dynamic route mounting complete. (${subDir || 'root'})`);
};