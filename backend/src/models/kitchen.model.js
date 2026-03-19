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

// ── FUNCIONES REQUERIDAS POR kitchen.helper.js ───────────────

// Platillos sin receta (has_recipe = false) — bandeja de pendientes
export const getPendingDishes = async (c) =>
    await executeQuery(c, `
        SELECT d.code AS "dishCode", d.name, d.price,
               c.code AS "categoryCode", c.name AS "categoryName"
        FROM menu_dishes d
        JOIN menu_categories c ON c.id = d.category_id
        WHERE d.is_active = true AND d.has_recipe = false
        ORDER BY c.name, d.name
    `);

// Alias para kitchen.helper — addIngredient ya existe pero el helper llama createIngredient
export const createIngredient = async (c, code, name, unit) =>
    await executeStoredProcedure(c, 'sp_create_ingredient', {
        p_code: code,
        p_name: name,
        p_unit: unit
    });

// Platillos con receta completa (has_recipe = true) — catálogo del recetario
export const getFinishedDishes = async (c) =>
    await executeQuery(c, `
        SELECT d.code AS "dishCode", d.name, d.price,
               d.image_url AS "imageUrl",
               d.preparation_method AS "preparationMethod",
               c.code AS "categoryCode", c.name AS "categoryName"
        FROM menu_dishes d
        JOIN menu_categories c ON c.id = d.category_id
        WHERE d.is_active = true AND d.has_recipe = true
        ORDER BY c.name, d.name
    `);

// BOM de un platillo — ingredientes + cantidades
export const getRecipeBOM = async (c, dishCode) =>
    await executeQuery(c, `
        SELECT i.code, i.name, dr.quantity_required AS qty, i.recipe_unit AS unit
        FROM dish_recipes dr
        JOIN inventory_items i ON i.id = dr.item_id
        JOIN menu_dishes d     ON d.id = dr.dish_id
        WHERE d.code = $1
        ORDER BY i.name
    `, [dishCode]);

// Tablero KDS completo (PENDING_KITCHEN + PREPARING)
export const getKitchenBoard = async (c) =>
    await executeQuery(c, `
        SELECT oi.id        AS item_id,
               md.name      AS dish_name,
               oi.quantity,
               oi.notes,
               oi.status,
               oi.started_at,
               oi.created_at,
               oh.code      AS order_code,
               rt.code      AS table_code,
               e.first_name AS waiter_name
        FROM order_items oi
        JOIN order_headers oh    ON oh.id = oi.order_id
        JOIN restaurant_tables rt ON rt.id = oh.table_id
        JOIN menu_dishes md      ON md.id = oi.dish_id
        JOIN employees e         ON e.id  = oh.waiter_id
        WHERE oi.status IN ('PENDING_KITCHEN', 'PREPARING')
        ORDER BY oi.created_at ASC
    `);

// ── KDS — LECTURA (existente, renombrado para no romper) ──────

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