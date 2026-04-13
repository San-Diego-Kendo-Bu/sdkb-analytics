const { query } = require("../../shared_utils/db");
const { verifyMemberExists } = require("../../shared_utils/members");

const TOURNAMENT_REGISTRATION_TABLE = "tournament_registrations";
const SHINSA_REGISTRATION_TABLE = "shinsa_registrations";
const SEMINAR_REGISTRATION_TABLE = "seminar_registrations";

exports.handler = async (event) => {
    try {
        const parameters = JSON.parse(event.body || "{}");

        const configType = parameters.config_type;
        const eventId = parseInt(parameters.event_id, 10);
        const memberId = parseInt(parameters.member_id, 10);

        if (Number.isNaN(eventId) || Number.isNaN(memberId)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "event_id and member_id must be valid numbers" })
            };
        }

        const memberExists = await verifyMemberExists(memberId);
        if (!memberExists) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Member not found" })
            };
        }

        let result;

        if (configType === "tournament") {
            result = await query(
                `
                DELETE FROM ${TOURNAMENT_REGISTRATION_TABLE}
                WHERE event_id = $1 AND member_id = $2
                RETURNING event_id, member_id, registration_date, shinpanning, division, doing_teams
                `,
                [eventId, memberId]
            );
        } else if (configType === "shinsa") {
            result = await query(
                `
                DELETE FROM ${SHINSA_REGISTRATION_TABLE}
                WHERE event_id = $1 AND member_id = $2
                RETURNING event_id, member_id, registration_date, testing_for
                `,
                [eventId, memberId]
            );
        } else if (configType === "seminar") {
            result = await query(
                `
                DELETE FROM ${SEMINAR_REGISTRATION_TABLE}
                WHERE event_id = $1 AND member_id = $2
                RETURNING event_id, member_id, registration_date
                `,
                [eventId, memberId]
            );
        } else {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Invalid config_type" })
            };
        }

        if (result.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Registration not found" })
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Event Unregistered Successfully",
                data: result.rows[0],
            })
        };

    } catch (err) {
        console.error("unregisterEvent error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};