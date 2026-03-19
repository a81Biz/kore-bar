import { executeQuery } from '../db/connection.js';

export const createCategory = async (c, code, name, description) =>
    await executeQuery(c, 'SELECT sp_create_menu_category($1::VARCHAR, $2::VARCHAR, $3::TEXT)', [code, name, description]);

export const updateCategory = async (c, code, name, description, isActive) =>
    await executeQuery(c, 'SELECT sp_update_menu_category($1::VARCHAR, $2::VARCHAR, $3::TEXT, $4::BOOLEAN)', [code, name, description, isActive]);

export const getCategories = async (c) =>
    await executeQuery(c, 'SELECT code AS "categoryCode", name, description, is_active AS "isActive" FROM menu_categories ORDER BY created_at ASC');

export const deleteCategorySmart = async (c, code) =>
    await executeQuery(c, 'SELECT sp_delete_menu_category_smart($1::VARCHAR)', [code]);

export const createDish = async (c, code, catCode, name, desc, price, img) =>
    await executeQuery(c, 'SELECT sp_create_menu_dish($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::TEXT, $5::DECIMAL, $6::VARCHAR)', [code, catCode, name, desc, price, img]);

export const updateDish = async (c, code, catCode, name, desc, price, img, isActive) =>
    await executeQuery(c, 'SELECT sp_update_menu_dish($1::VARCHAR, $2::VARCHAR, $3::VARCHAR, $4::TEXT, $5::DECIMAL, $6::VARCHAR, $7::BOOLEAN)', [code, catCode, name, desc, price, img, isActive]);

export const getDishes = async (c) =>
    await executeQuery(c, 'SELECT dish_code AS "dishCode", category_code AS "categoryCode", category_name AS "categoryName", name, description, price, image_url AS "imageUrl", is_active AS "isActive", has_recipe AS "hasRecipe" FROM vw_menu_dishes');

export const deleteDishSmart = async (c, code) =>
    await executeQuery(c, 'SELECT sp_delete_menu_dish_smart($1::VARCHAR)', [code]);