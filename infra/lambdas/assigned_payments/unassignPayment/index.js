const { getSupabase } = require("../../shared_utils/supabase");
const { normalizeGroups } = require("../../shared_utils/utils");

const ASSIGNED_PAYMENTS_TABLE = "AssignedPayments";

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;

const REQUIRED_FIELDS = ["member_id", "payment_id"];

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

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        // Delete AssignedPayment with member_id, payment_id
        const response = await supabase.from(ASSIGNED_PAYMENTS_TABLE)
            .delete()
            .match(payload)
            .select();

        if (response.error) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            };
        }

        const data = response.data[0];
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                payment_id: data.payment_id,
                member_id: data.member_id,
                data: data,
            })
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
}