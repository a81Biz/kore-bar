import { executeQuery } from '../db/connection.js';

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
        const sql = `
            INSERT INTO waiter_calls (table_id, reason, status)
            VALUES (
                (SELECT id FROM restaurant_tables WHERE code = $1),
                $2,
                'PENDING'
            ) RETURNING id
        `;
        try {
            const res = await executeQuery(c, sql, [tableCode, reason]);
            return res[0];
        } catch (error) {
            if (error.code === '23502') {
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
        const sql = `
            UPDATE waiter_calls
            SET status = 'ATTENDED', updated_at = NOW()
            WHERE id = $1 AND status = 'PENDING'
            RETURNING id
        `;
        const res = await executeQuery(c, sql, [callId]);
        if (!res || res.length === 0) {
            throw new Error('Llamada no encontrada o ya atendida');
        }
        return res[0];
    }
};
