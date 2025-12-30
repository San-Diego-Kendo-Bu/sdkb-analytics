const { getSupabase } = require("../../shared_utils/supabase");
const { normalizeGroups } = require("../../shared_utils");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const SHINSA_REGISTRATION_TABLE = "ShinsaRegistrations";
const REGION = process.env.AWS_REGION;

const SHINSA_FIELDS = ["event_id", "member_id", "registered_date", "testing_for"];

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = event.headers;
        const payload = {};

        for (const field of SHINSA_FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = (Object.keys(payload).length === 0) ?
            await supabase.from(SHINSA_REGISTRATION_TABLE).select("*") :
            await supabase.from(SHINSA_REGISTRATION_TABLE).select("*").match(payload);

        if (response.error) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error }),
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Registration(s) retrieved successfully.",
                payload: payload,
                body: response.data,
            })
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};