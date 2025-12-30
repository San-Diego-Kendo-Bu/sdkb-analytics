const { getSupabase, callPostgresFunction } = require("../../shared_utils/supabase");
const { verifyMemberExists } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { normalizeGroups } = require("../../shared_utils/utils");

const REQUIRED_FIELDS = ["member_id", "payment_id"];

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body);
        const payload = {};

        for (const field of REQUIRED_FIELDS) {
            if (!parameters[field]) {
                return {
                    statusCode: 400,
                    body: `${field} is missing from your request, please include it.`
                };
            }
            payload[field] = parameters[field];
        }

        const memberId = parseInt(payload['member_id']);
        const memberFound = await verifyMemberExists(memberId);
        if (!memberFound) {
            return { statusCode: 400, body: "Invalid member ID." };
        }

        payload["assigned_on"] = parameters["assigned_on"] ? parameters["assigned_on"] : getCurrentTimeUTC();

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const args = {
            p_member_id: payload.member_id,
            p_payment_id: payload.payment_id,
            p_assigned_on: payload.assigned_on,
            p_status: "due"
        }

        const response = await callPostgresFunction('assign_payment', args, supabase);
        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
}