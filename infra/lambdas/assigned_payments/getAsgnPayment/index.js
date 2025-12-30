const { getSupabase, getFromTable } = require("../../shared_utils/supabase");

const ASSIGNED_PAYMENTS_TABLE = "AssignedPayments";
const FIELDS = ["member_id", "payment_id", "status", "assigned_on"];

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
        const parameters = event.headers;
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = getFromTable(ASSIGNED_PAYMENTS_TABLE, FIELDS, parameters, supabase);

        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
}