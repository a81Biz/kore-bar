import { executeQuery } from '../db/connection.js';

export const PublicMenuModel = {
    // CU-PUB-01: Obtener categorías activas y sus platillos activos anidados
    getMenu: async () => {
        // Aprovechamos los JSON aggregations nativos de PostgreSQL para traer una estructura perfecta en 1 sola consulta
        const sql = `
            SELECT 
                c.code AS "categoryCode",
                c.name AS "categoryName",
                c.description AS "categoryDesc",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'dishCode', d.code,
                            'name', d.name,
                            'description', d.description,
                            'price', d.price,
                            'imageUrl', d.image_url
                        )
                    ) FILTER (WHERE d.code IS NOT NULL), 
                    '[]'
                ) AS "dishes"
            FROM menu_categories c
            LEFT JOIN menu_dishes d ON c.id = d.category_id AND d.is_active = true
            WHERE c.is_active = true
            GROUP BY c.id, c.code, c.name, c.description
            ORDER BY c.name ASC;
        `;
        const result = await executeQuery(null, sql);
        return result;
    },

    // CU-PUB-02: Registrar alerta al mesero desde la mesa
    registerCall: async (tableCode, reason) => {
        // En un caso real aqui existiriá la tabla waiter_calls para auditoría
        // Opcionalmente se dispara un Evento (SSE/WebSocket) a la terminal del mesero/KDS.
        const sql = `
            INSERT INTO waiter_calls (table_id, reason, status)
            VALUES (
                (SELECT id FROM restaurant_tables WHERE code = $1),
                $2,
                'PENDING'
            ) RETURNING id;
        `;
        try {
            const res = await executeQuery(null, sql, [tableCode, reason]);
            return res[0];
        } catch (error) {
            if (error.code === '23502') { // null value in column "table_id" violates not-null constraint
                throw new Error('Mesa no encontrada o inválida.');
            }
            throw error;
        }
    }
};
