import { Hono } from 'hono';
import { buildRoutes } from '../engine/schemaRouter.js';

const publicRouter = new Hono();

// Dynamic Schema-Driven Flows para el Menú QR y Públicos
buildRoutes(publicRouter, 'public');

export default publicRouter;
