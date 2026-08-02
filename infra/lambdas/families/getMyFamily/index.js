const { query } = require("../../shared_utils/db");
const { resolveActingMemberId } = require("../../shared_utils/families");

const H = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    try {
        const memberId = await resolveActingMemberId(claims);
        if (memberId == null) {
            return { statusCode: 401, headers: H, body: JSON.stringify({ error: "Member not found for this account" }) };
        }

        const result = await query(
            `SELECT f.family_id, f.family_name, fm1.is_parent AS caller_is_parent,
                    json_agg(
                        json_build_object('member_id', fm2.member_id, 'is_parent', fm2.is_parent)
                        ORDER BY fm2.member_id
                    ) AS members
             FROM family_members fm1
             JOIN families f ON f.family_id = fm1.family_id
             JOIN family_members fm2 ON fm2.family_id = fm1.family_id
             WHERE fm1.member_id = $1
             GROUP BY f.family_id, f.family_name, fm1.is_parent`,
            [memberId]
        );

        if (result.rowCount === 0) {
            return {
                statusCode: 200,
                headers: H,
                body: JSON.stringify({ family_id: null, family_name: null, is_parent: false, members: [] }),
            };
        }

        const row = result.rows[0];

        return {
            statusCode: 200,
            headers: H,
            body: JSON.stringify({
                family_id: row.family_id,
                family_name: row.family_name,
                is_parent: row.caller_is_parent,
                members: row.members,
            }),
        };
    } catch (err) {
        console.error("getMyFamily error:", err);
        return { statusCode: 500, headers: H, body: JSON.stringify({ error: err.message }) };
    }
};
