const { getSupabase, callPostgresFunction } = require("../../shared_utils/supabase");
const { normalizeGroups } = require("../../shared_utils/utils");

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
        const paymentId = parameters.payment_id;

        if (!paymentId) {
            return {
                status: 400,
                message: "Please specify a payment id"
            }
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const args = { p_payment_id: paymentId };
        const response = callPostgresFunction('remove_payment', args, supabase);

        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};