const { getCurrentTimeUTC } = require("../../shared_utils/dates");
const { getSupabase, callPostgresFunction } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

const { normalizeGroups } = require("../../shared_utils/normalize_claim");

exports.handler = async (event) => {

    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body);

        const title = parameters.title;
        const createdAt = parameters.created_at ? parameters.created_at : getCurrentTimeUTC();
        const dueDate = parameters.due_date;
        const paymentValue = parameters.payment_value ? parseFloat(parameters.payment_value) : null;
        const overduePenalty = parameters.overdue_penalty ? parseFloat(parameters.overdue_penalty) : 0.0;

        if (!paymentValue || paymentValue < 1.0) {
            return {
                statusCode: 400,
                message: "Invalid payment value. Please create a payment of at least $1.00.",
                body: JSON.stringify({
                    message: "Please create a payment of at least $1.00.",
                    payment_value: paymentValue
                })
            };
        }

        if (overduePenalty < 0.0) {
            return {
                statusCode: 400,
                message: "Invalid overdue penalty value. Please create a penalty of at least $0.00.",
                body: JSON.stringify({
                    message: "Please create a penalty of at least $0.00.",
                    payment_value: overduePenalty
                })
            };
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const args = {
            p_title: title,
            p_created_at: createdAt,
            p_due_date: dueDate,
            p_payment_value: paymentValue,
            p_overdue_penalty: overduePenalty
        };

        const response = await callPostgresFunction('create_payment', args, supabase);
        return response;

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};