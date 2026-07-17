const { query } = require("../../shared_utils/db");

exports.handler = async () => {
    try {
        const result = await query(`
            SELECT f.family_id, f.family_name, f.created_at,
                   COALESCE(
                       json_agg(
                           json_build_object('member_id', fm.member_id, 'is_parent', fm.is_parent)
                           ORDER BY fm.member_id
                       ) FILTER (WHERE fm.member_id IS NOT NULL),
                       '[]'::json
                   ) AS members
            FROM families f
            LEFT JOIN family_members fm ON f.family_id = fm.family_id
            GROUP BY f.family_id, f.family_name, f.created_at
            ORDER BY f.family_name
        `);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ families: result.rows }),
        };
    } catch (err) {
        console.error("getFamilies error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
