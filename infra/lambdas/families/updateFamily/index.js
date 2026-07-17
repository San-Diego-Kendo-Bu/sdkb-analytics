const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};
    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const { family_id, family_name, members } = JSON.parse(event.body || "{}");

        if (!family_id) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "family_id is required" }),
            };
        }

        const exists = await query(`SELECT 1 FROM families WHERE family_id = $1`, [family_id]);
        if (exists.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: "Family not found" }),
            };
        }

        if (family_name?.trim()) {
            await query(`UPDATE families SET family_name = $1 WHERE family_id = $2`, [family_name.trim(), family_id]);
        }

        // Replace member list if provided
        if (Array.isArray(members)) {
            await query(`DELETE FROM family_members WHERE family_id = $1`, [family_id]);
            const seen = new Set();
            for (const m of members) {
                const memberId = Number(m.member_id);
                if (!memberId || seen.has(memberId)) continue;
                seen.add(memberId);
                await query(
                    `INSERT INTO family_members (family_id, member_id, is_parent) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                    [family_id, memberId, !!m.is_parent]
                );
            }
        }

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Family updated" }),
        };
    } catch (err) {
        console.error("updateFamily error:", err);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: err.message }),
        };
    }
};
