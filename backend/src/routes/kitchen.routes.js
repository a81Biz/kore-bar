import { Hono } from 'hono';
import { buildRoutes } from '../engine/schemaRouter.js';

const kitchenRouter = new Hono();

// Dynamic Schema-Driven Flows
buildRoutes(kitchenRouter, 'kitchen');

export default kitchenRouter;
