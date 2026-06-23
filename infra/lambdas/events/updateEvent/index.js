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

        if (payload.payment_id) {
            const conflict = await query(
                `SELECT event_id FROM ${EVENTS_TABLE} WHERE payment_id = $1 AND event_id != $2 LIMIT 1`,
                [payload.payment_id, eventId]
            );
            if (conflict.rowCount > 0) {
                return {
                    statusCode: 409,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: `payment_id ${payload.payment_id} is already linked to event ${conflict.rows[0].event_id}.` }),
                };
            }
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

        // If a payment was just linked, auto-assign it to all existing registrants
        if (payload.payment_id) {
            const paymentResult = await query(
                `SELECT due_date FROM payments WHERE payment_id = $1`,
                [payload.payment_id]
            );
            const dueDate = paymentResult.rows[0]?.due_date;
            const todayStr = new Date().toISOString().slice(0, 10);
            const dueDateStr = dueDate ? new Date(dueDate).toISOString().slice(0, 10) : null;
            const dueStatus = dueDateStr && todayStr > dueDateStr ? 'overdue' : 'due';
            const now = new Date().toISOString();

            const [tourn, shinsa, seminar] = await Promise.all([
                query(`SELECT member_id FROM tournament_registrations WHERE event_id = $1`, [eventId]),
                query(`SELECT member_id FROM shinsa_registrations WHERE event_id = $1`, [eventId]),
                query(`SELECT member_id FROM seminar_registrations WHERE event_id = $1`, [eventId]),
            ]);

            const memberIds = [...new Set([
                ...tourn.rows.map(r => r.member_id),
                ...shinsa.rows.map(r => r.member_id),
                ...seminar.rows.map(r => r.member_id),
            ])];

            await Promise.all(memberIds.map(async memberId => {
                const alreadyPaid = await query(
                    `SELECT 1 FROM submitted_payments WHERE member_id = $1 AND payment_id = $2 LIMIT 1`,
                    [memberId, payload.payment_id]
                );
                if (alreadyPaid.rowCount === 0) {
                    await query(
                        `INSERT INTO assigned_payments (member_id, payment_id, assigned_on, due_status)
                         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                        [memberId, payload.payment_id, now, dueStatus]
                    );
                }
            }));
        }

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