import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── RECETARIO (TECH SHEET) ────────────────────────────────────
// Antes: UPDATE raw directo en el modelo
// Ahora: sp_update_tech_sheet (crítico #1 + #5)

export const updateTechSheet = async (c, dishCode, preparationMethod, imageUrl) =>
    await executeStoredProcedure(c, 'sp_update_tech_sheet', {
        p_dish_code: dishCode,
        p_preparation_method: preparationMethod,
        p_image_url: imageUrl ?? null
    });

export const getRecipes = async (c) =>
    await executeQuery(c, `
        SELECT d.code     AS "dishCode",
               d.name,
               d.price,
               d.image_url           AS "imageUrl",
               d.preparation_method  AS "preparationMethod",
               d.has_recipe          AS "hasRecipe",
               c.code    AS "categoryCode",
               c.name    AS "categoryName",
               COALESCE(
                   jsonb_agg(
                       jsonb_build_object(
                           'itemCode',         i.code,
                           'itemName',         i.name,
                           'unit',             i.recipe_unit,
                           'quantityRequired', dr.quantity_required
                       )
                   ) FILTER (WHERE dr.id IS NOT NULL),
                   '[]'::jsonb
               ) AS recipe
        FROM menu_dishes d
        JOIN menu_categories c ON c.id = d.category_id
        LEFT JOIN dish_recipes dr     ON dr.dish_id = d.id
        LEFT JOIN inventory_items i   ON i.id = dr.item_id
        WHERE d.is_active = true
        GROUP BY d.id, d.code, d.name, d.price, d.image_url,
                 d.preparation_method, d.has_recipe, c.code, c.name
        ORDER BY c.name, d.name
    `);

export const getIngredients = async (c) =>
    await executeQuery(c, `
        SELECT code, name, recipe_unit AS "unit"
        FROM inventory_items
        WHERE is_active = true
        ORDER BY name ASC
    `);

export const addIngredient = async (c, code, name, unit) =>
    await executeStoredProcedure(c, 'sp_create_ingredient', {
        p_code: code,
        p_name: name,
        p_unit: unit
    });

export const addRecipeItem = async (c, dishCode, ingredientCode, quantity) =>
    await executeStoredProcedure(c, 'sp_add_recipe_item', {
        p_dish_code: dishCode,
        p_ingredient_code: ingredientCode,
        p_quantity: quantity
    });


// ── KDS — MÁQUINA DE ESTADOS ──────────────────────────────────
// Antes: UPDATE raw sin validar la transición de estado (críticos #1 y #5)
// Ahora: sp_kds_set_preparing y sp_kds_set_ready validan en BD que
//        la transición sea válida (PENDING_KITCHEN → PREPARING → READY).
//        Si el estado actual no coincide, el SP lanza excepción P0001.

export const setItemPreparing = async (c, itemId) =>
    await executeStoredProcedure(c, 'sp_kds_set_preparing', {
        p_item_id: itemId
    }, { p_item_id: 'UUID' });

export const setItemReady = async (c, itemId) =>
    await executeStoredProcedure(c, 'sp_kds_set_ready', {
        p_item_id: itemId
    }, { p_item_id: 'UUID' });

// ── KDS — LECTURA ─────────────────────────────────────────────

export const getPendingKdsItems = async (c) =>
    await executeQuery(c, `
        SELECT oi.id,
               oi.order_id  AS "orderId",
               rt.code      AS "tableCode",
               md.code      AS "dishCode",
               md.name,
               oi.quantity,
               oi.notes,
               oi.status,
               oi.started_at AS "startedAt",
               oi.created_at AS "createdAt"
        FROM order_items oi
        JOIN order_headers oh ON oh.id = oi.order_id
        JOIN restaurant_tables rt ON rt.id = oh.table_id
        JOIN menu_dishes md ON md.id = oi.dish_id
        WHERE oi.status IN ('PENDING_KITCHEN', 'PREPARING')
        ORDER BY oi.created_at ASC
    `);
