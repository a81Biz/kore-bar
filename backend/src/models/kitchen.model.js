import { executeQuery } from '../db/connection.js';

export const getPendingDishes = async (c) =>
    await executeQuery(c, 'SELECT dish_code AS "dishCode", category_name AS "categoryName", name, description, image_url AS "imageUrl" FROM vw_menu_dishes WHERE has_recipe = false AND is_active = true');

export const createIngredient = async (c, code, name, unit) =>
    await executeQuery(c, 'SELECT sp_create_ingredient($1::VARCHAR, $2::VARCHAR, $3::VARCHAR)', [code, name, unit]);

export const getIngredients = async (c) =>
    await executeQuery(c, 'SELECT code, name, COALESCE(recipe_unit, unit_measure) AS unit, is_active AS "isActive" FROM inventory_items WHERE is_active = true ORDER BY name');

export const addRecipeItem = async (c, dishCode, ingredientCode, quantity) =>
    await executeQuery(c, 'SELECT sp_add_recipe_item($1::VARCHAR, $2::VARCHAR, $3::DECIMAL)', [dishCode, ingredientCode, quantity]);

export const getFinishedDishes = async (c) =>
    await executeQuery(c, 'SELECT dish_code AS "dishCode", category_name AS "categoryName", name, description, image_url AS "imageUrl", preparation_method AS "preparationMethod" FROM vw_menu_dishes WHERE has_recipe = true AND is_active = true ORDER BY name');

export const getRecipeBOM = async (c, dishCode) =>
    await executeQuery(c, 'SELECT i.code, i.name, dr.quantity_required AS qty, COALESCE(i.recipe_unit, i.unit_measure) AS unit FROM dish_recipes dr JOIN inventory_items i ON dr.item_id = i.id JOIN menu_dishes d ON dr.dish_id = d.id WHERE d.code = $1', [dishCode]);

export const updateTechSheet = async (c, dishCode, prepMethod, imageUrl) =>
    await executeQuery(c, 'UPDATE menu_dishes SET preparation_method = $1, image_url = COALESCE($2, image_url) WHERE code = $3', [prepMethod, imageUrl, dishCode]);

export const getKitchenBoard = async (c) =>
    await executeQuery(c, `
        SELECT
            oi.id          AS item_id,
            md.name        AS dish_name,
            oi.quantity,
            oi.notes,
            oi.status,
            oi.started_at,
            oi.created_at,
            oh.code        AS order_code,
            rt.code        AS table_code,
            e.first_name   AS waiter_name
        FROM order_items oi
        JOIN order_headers oh     ON oi.order_id  = oh.id
        JOIN restaurant_tables rt ON oh.table_id  = rt.id
        JOIN menu_dishes md       ON oi.dish_id   = md.id
        JOIN employees e          ON oh.waiter_id = e.id
        WHERE md.has_recipe = true
          AND oi.status IN ('PENDING_KITCHEN', 'PREPARING', 'READY')
        ORDER BY oi.created_at ASC
    `);

export const setItemPreparing = async (c, itemId) =>
    await executeQuery(c, `
        UPDATE order_items
        SET status = 'PREPARING', started_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'PENDING_KITCHEN'
        RETURNING id
    `, [itemId]);

export const setItemReady = async (c, itemId) =>
    await executeQuery(c, `
        UPDATE order_items
        SET status = 'READY'
        WHERE id = $1 AND status = 'PREPARING'
        RETURNING id
    `, [itemId]);