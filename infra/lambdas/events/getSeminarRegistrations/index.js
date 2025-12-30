const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const SEMINAR_REGISTRATION_TABLE = "SeminarRegistrations";
const REGION = process.env.AWS_REGION;

const SEMINAR_FIELDS = ["event_id", "member_id", "registered_date"];

exports.handler = async (event) => {

    try {
        const parameters = event.headers;
        const payload = {};

        for (const field of SEMINAR_FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = (Object.keys(payload).length === 0) ?
            await supabase.from(SEMINAR_REGISTRATION_TABLE).select("*") :
            await supabase.from(SEMINAR_REGISTRATION_TABLE).select("*").match(payload);

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
                message: "Registrations(s) retrieved successfully.",
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