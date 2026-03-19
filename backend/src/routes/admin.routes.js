import { Hono } from 'hono';
import { buildRoutes } from '../engine/schemaRouter.js';

const adminRouter = new Hono();

// Dynamic Schema-Driven Flows
buildRoutes(adminRouter, 'admin');

export default adminRouter;
