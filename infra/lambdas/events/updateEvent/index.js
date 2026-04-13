const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const EVENTS_TABLE = "events";
const FIELDS = [
    "event_id",
    "event_date",
    "event_name",
    "event_type",
    "event_deadline",
    "created_at",
    "event_location",
    "payment_id"
];
const DATE_FIELDS = ["event_date", "event_deadline", "created_at"];

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const eventId = parseInt(parameters.event_id, 10);

        if (Number.isNaN(eventId)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Missing or invalid value for event_id" })
            };
        }

        const payload = {};
        for (const field of FIELDS) {
            if (field in parameters && field !== "event_id") {
                payload[field] = parameters[field];
            }
        }

        if (Object.keys(payload).length === 0) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "No update fields provided" })
            };
        }

        const malformedDateFields = [];
        const malformedDateFieldValues = [];

        DATE_FIELDS.forEach((fieldName) => {
            if (payload[fieldName] && !dateStringIsValid(payload[fieldName])) {
                malformedDateFields.push(fieldName);
                malformedDateFieldValues.push(payload[fieldName]);
            }
        });

        if (malformedDateFields.length !== 0) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Supplied dates are not in valid format",
                    malformed_fields: malformedDateFields,
                    malformed_values: malformedDateFieldValues
                })
            };
        }

        if (
            payload.event_date &&
            payload.event_deadline &&
            new Date(payload.event_date) < new Date(payload.event_deadline)
        ) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: "Event date cannot be earlier than event deadline",
                    event_date: payload.event_date,
                    event_deadline: payload.event_deadline
                })
            };
        }

        const updateKeys = Object.keys(payload);

        const setClause = updateKeys
            .map((key, index) => `${key} = $${index + 1}`)
            .join(", ");

        const values = [
            ...updateKeys.map((key) => payload[key]),
            eventId
        ];

        const result = await query(
            `
            UPDATE ${EVENTS_TABLE}
            SET ${setClause}
            WHERE event_id = $${updateKeys.length + 1}
            RETURNING
                event_id,
                event_date,
                event_name,
                event_type,
                event_deadline,
                created_at,
                event_location,
                payment_id
            `,
            values
        );

        if (result.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Event not found" })
            };
        }

        const data = result.rows[0];

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Updated Event Successfully",
                id: data.event_id,
                data,
            })
        };

    } catch (err) {
        console.error("updateEvent error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};

function dateStringIsValid(dateString) {
    const date = new Date(dateString);
    return !isNaN(date);
}