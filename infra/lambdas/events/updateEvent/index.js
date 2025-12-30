const { getSupabase } = require("../../shared_utils/supabase");
const { normalizeGroups } = require("../../shared_utils/utils");

const EVENTS_TABLE = "Events";
const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;
const FIELDS = ["event_id", "event_date", "event_name", "event_type", "event_deadline", "created_at", "event_location", "payment_id"];
const DATE_FIELDS = ["event_date", "event_deadline", "created_at"];

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
                message: "Missing value for event_id"
            }
        }

        const payload = {};
        for (const field of FIELDS) {
            if (field in parameters) {
                payload[field] = parameters[field];
            }
        }

        const malformedDateFields = [];
        const malformedDateFieldValues = [];

        DATE_FIELDS.forEach((fieldName) => {
            if (payload[fieldName] && !dateStringIsValid(payload[fieldName])) {
                malformedDateFields.push(fieldName);
                malformedDateFieldValues.push(payload[fieldName]);
            }
        });

        if (malformedDateFields.length != 0) {
            return {
                statusCode: 400,
                message: "Invalid date format for field(s): " + malformedDateFields,
                body: JSON.stringify({
                    message: "Supplied dates are not in valid format: " + malformedDateFields,
                    malformed_values: malformedDateFieldValues
                })
            };
        }

        if (payload.event_date && payload.event_deadline &&
            new Date(payload.event_date) < new Date(payload.event_deadline)) {
            return {
                statusCode: 400,
                message: "Event date cannot be earlier than event deadline",
                body: JSON.stringify({
                    message: "Event date cannot be earlier than event deadline",
                    event_date: payload.event_date,
                    event_deadline: payload.event_deadline
                })
            };
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = await supabase.from(EVENTS_TABLE)
            .update(payload)
            .eq('event_id', eventId);

        if (response.error) {
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error }),
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
                message: "Updated Event Successfully",
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

function dateStringIsValid(dateString) {
    const date = new Date(dateString)
    return !isNaN(date);
}
