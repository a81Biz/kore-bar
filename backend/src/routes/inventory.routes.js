import { Hono } from 'hono';
import { buildRoutes } from '../engine/schemaRouter.js';

const inventoryRouter = new Hono();

// Dynamic Schema-Driven Flows
buildRoutes(inventoryRouter, 'inventory');

export default inventoryRouter;
