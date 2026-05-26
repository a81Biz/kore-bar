import { executeQuery, executeStoredProcedure } from '../db/connection.js';

export const PublicMenuModel = {
    getMenu: async (c) => {
        const sql = `
            SELECT
                c.code          AS "categoryCode",
                c.name          AS "categoryName",
                c.description   AS "categoryDesc",
                c.route_to_kds  AS "routeToKds",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'dishCode',    d.code,
                            'name',        d.name,
                            'description', d.description,
                            'price',       d.price,
                            'imageUrl',    d.image_url,
                            'hasRecipe',   d.has_recipe,
                            'isActive',    d.is_active
                        )
                    ) FILTER (WHERE d.code IS NOT NULL),
                    '[]'
                ) AS "dishes"
            FROM menu_categories c
            LEFT JOIN menu_dishes d ON c.id = d.category_id AND d.is_active = true
            WHERE c.is_active = true
            GROUP BY c.id, c.code, c.name, c.description, c.route_to_kds
            ORDER BY c.name ASC
        `;
        return await executeQuery(c, sql);
    },

    registerCall: async (c, tableCode, reason) => {
        try {
            await executeStoredProcedure(c, 'sp_register_waiter_call', {
                p_table_code: tableCode,
                p_reason:     reason
            });
        } catch (error) {
            if (error.code === '23502' || error.message?.includes('Mesa no encontrada')) {
                throw new Error('Mesa no encontrada o inválida.');
            }
            throw error;
        }
    },

    getPendingCalls: async (c) => {
        const sql = `
            SELECT
                wc.id,
                rt.code       AS "tableCode",
                wc.reason,
                wc.status,
                wc.created_at AS "createdAt"
            FROM waiter_calls wc
            JOIN restaurant_tables rt ON rt.id = wc.table_id
            WHERE wc.status = 'PENDING'
              AND wc.created_at > NOW() - INTERVAL '8 hours'
            ORDER BY wc.created_at ASC
        `;
        return await executeQuery(c, sql);
    },

    attendCall: async (c, callId) => {
        await executeStoredProcedure(c, 'sp_attend_waiter_call', {
            p_call_id: callId
        }, { p_call_id: 'UUID' });
    }
};
