const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;
const EVENTS_TABLE = "Events";

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {

        const parameters = JSON.parse(event.body);
        const eventId = parameters.event_id;

        if (!eventId) {
            return {
                status: 400,
                message: "Please specify a event id"
            }
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = await supabase.from(EVENTS_TABLE).delete().eq('event_id', eventId);

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
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Deleted Event Successfully",
                id: data.event_id,
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
};