import { executeQuery, executeStoredProcedure } from '../db/connection.js';

// ── CATEGORÍAS ────────────────────────────────────────────────

export const createCategory = async (c, code, name, description) =>
    await executeStoredProcedure(c, 'sp_create_menu_category', {
        p_code: code,
        p_name: name,
        p_description: description
    });

export const updateCategory = async (c, code, name, description, isActive) =>
    await executeStoredProcedure(c, 'sp_update_menu_category', {
        p_code: code,
        p_name: name,
        p_description: description,
        p_is_active: isActive
    });

export const getCategories = async (c) =>
    await executeQuery(c, `
        SELECT code AS "categoryCode", name, description, is_active AS "isActive"
        FROM menu_categories
        ORDER BY created_at ASC
    `);

export const deleteCategorySmart = async (c, code) =>
    await executeStoredProcedure(c, 'sp_delete_menu_category_smart', { p_code: code });


// ── PLATILLOS ──────────────────────────────────────────────────

export const createDish = async (c, code, catCode, name, desc, price, img) =>
    await executeStoredProcedure(c, 'sp_create_menu_dish', {
        p_code: code,
        p_category_code: catCode,
        p_name: name,
        p_description: desc,
        p_price: price,
        p_image_url: img,
        p_can_pickup: false
    });

export const updateDish = async (c, code, catCode, name, desc, price, img, isActive, canPickup) =>
    await executeStoredProcedure(c, 'sp_update_menu_dish', {
        p_code: code,
        p_category_code: catCode,
        p_name: name,
        p_description: desc,
        p_price: price,
        p_image_url: img,
        p_is_active: isActive,
        p_can_pickup: canPickup ?? false   // ← nuevo parámetro
    });

export const getDishes = async (c) =>
    await executeQuery(c, `
         SELECT dish_code      AS "dishCode",
               category_code  AS "categoryCode",
               category_name  AS "categoryName",
               name,
               description,
               price,
               image_url      AS "imageUrl",
               is_active      AS "isActive",
               has_recipe     AS "hasRecipe",
               preparation_method AS "preparationMethod",
               can_pickup     AS "canPickup"
        FROM vw_menu_dishes
    `);

export const deleteDishSmart = async (c, code) =>
    await executeStoredProcedure(c, 'sp_delete_menu_dish_smart', { p_code: code });
