// src/engine/orchestrator.js
import { ActionRegistry } from './registry.js';
import { AppError } from '../utils/errors.util.js';

/**
 * Core Workflow Engine Orchestrator
 * Executes declarative JSON state machines dynamically.
 * 
 * @param {Object} workflowJson - The declarative schema definition
 * @param {Object} initialState - Mutable state object injected into all handlers
 * @param {Object} context - Optional context (e.g. Hono "c" object) for scoped functionality
 * @returns {Promise<Object>} The final mutated state
 */
export const executeWorkflow = async (workflowJson, initialState, context) => {
    let currentNodeId = workflowJson.startAt;
    let stepCount = 0;
    const MAX_STEPS = 100; // Infinite Loop Circuit Breaker Limit

    console.log(`[Engine] Starting Workflow: ${workflowJson.workflow} at node: ${currentNodeId}`);

    while (currentNodeId !== 'end') {
        // [Protection] 1. Infinite Loop Circuit Breaker
        if (stepCount >= MAX_STEPS) {
            throw new AppError(`Workflow Engine stalled: Exceeded max steps (${MAX_STEPS}) indicating a possible infinite loop`, 500);
        }
        stepCount++;

        // [Protection] 2. Ghost Node Protection
        const node = workflowJson.nodes[currentNodeId];
        if (!node) {
            throw new AppError(`Workflow Engine Error: Node '${currentNodeId}' does not exist in the schema`, 500);
        }

        // Check if node is an end point
        if (node.type === 'end') {
            if (node.response) {
                initialState.response = node.response;
            }
            break;
        }

        // [Protection] 3. Unregistered Handler Protection
        const handler = ActionRegistry[node.handler];
        if (!handler) {
            console.error(`DUMP ACTION REGISTRY KEYS BEFORE ERROR:`, JSON.stringify(Object.keys(ActionRegistry)));
            throw new AppError(`Workflow Engine Error: Handler '${node.handler}' is not registered in ActionRegistry`, 500);
        }

        console.log(`[Engine] Step ${stepCount}: Executing node '${currentNodeId}' with handler '${node.handler}'`);

        // Execute Handler
        if (node.type === 'action') {
            await handler(initialState, context);
            currentNodeId = node.next;
        }
        else if (node.type === 'decision') {
            // Decisions must evaluate to a boolean
            const result = await handler(initialState, context);
            if (typeof result !== 'boolean') {
                throw new AppError(`Workflow Engine Error: Decision handler '${node.handler}' must return a boolean`, 500);
            }
            currentNodeId = result ? node.onTrue : node.onFalse;
        }
        else {
            throw new AppError(`Workflow Engine Error: Unknown node type '${node.type}'`, 500);
        }
    }

    console.log(`[Engine] Workflow '${workflowJson.workflow}' completed successfully after ${stepCount} steps.`);
    return initialState;
};
