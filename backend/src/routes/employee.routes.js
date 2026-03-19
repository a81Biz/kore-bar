import { Hono } from 'hono';
import { buildRoutes } from '../engine/schemaRouter.js';

const employeeRouter = new Hono();

// Dynamic Schema-Driven Flows
buildRoutes(employeeRouter, 'admin');

export default employeeRouter;
