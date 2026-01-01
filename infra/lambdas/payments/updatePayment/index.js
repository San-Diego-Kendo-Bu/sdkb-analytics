const { getSupabase, callPostgresFunction } = require("../../shared_utils/supabase");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

const FIELDS = ['payment_id', 'title', 'created_at', 'due_date', 'payment_value', 'overdue_penalty'];

exports.handler = async (event) => {

    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {

        const parameters = JSON.parse(event.body);

        if (!parameters.payment_id) {
            return {
                status: 400,
                message: "Please specify a payment id"
            }
        }

        const payload = {};
        for (const field of FIELDS) {
            payload[field] = (field in parameters) ? parameters[field] : null;
        }

        if (payload.payment_value && parseFloat(payload.payment_value) < 1.0) {
            return {
                statusCode: 400,
                message: "Invalid payment value. Please update payment to at least $1.00.",
                body: JSON.stringify({
                    message: " Please update payment to at least $1.00.",
                    payment_value: payload.payment_value
                })
            };
        }

        if (payload.overdue_penalty && parseFloat(payload.overdue_penalty) < 0.0) {
            return {
                statusCode: 400,
                message: "Invalid overdue value. Please update overdue value to at least $0.00.",
                body: JSON.stringify({
                    message: "Please update overdue value to at least $0.00.",
                    payment_value: payload.overdue_penalty
                })
            };
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const args = {
            p_payment_id: payload.payment_id,
            p_title: payload.title,
            p_created_at: payload.created_at,
            p_due_date: payload.due_date,
            p_payment_value: payload.payment_value,
            p_overdue_penalty: payload.overdue_penalty
        };
        const response = await callPostgresFunction('update_payment', args, supabase);
        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};