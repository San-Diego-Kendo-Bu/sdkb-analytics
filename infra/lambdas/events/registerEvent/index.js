const { query } = require("../../shared_utils/db");
const { verifyMemberExists } = require("../../shared_utils/members");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");

const TOURNAMENT_REGISTRATION_TABLE = "tournament_registrations";
const SHINSA_REGISTRATION_TABLE = "shinsa_registrations";
const SEMINAR_REGISTRATION_TABLE = "seminar_registrations";

exports.handler = async (event) => {
    try {
        const parameters = JSON.parse(event.body || "{}");

        const configType = parameters.config_type;
        const eventId = parameters.event_id;
        const memberId = parameters.member_id;
        const registeredDate = parameters.registration_date;

        const memberExists = await verifyMemberExists(memberId);
        if (!memberExists) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Member not found" })
            };
        }

        let registrationData;

        if (configType === "tournament") {
            const shinpanning = parameters.shinpanning;
            const division = parameters.division;
            const doingTeams = parameters.doing_teams;

            const result = await query(
                `
                INSERT INTO ${TOURNAMENT_REGISTRATION_TABLE} (
                    event_id, member_id, registration_date, shinpanning, division, doing_teams
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING event_id, member_id, registration_date, shinpanning, division, doing_teams
                `,
                [eventId, memberId, registeredDate, shinpanning, division, doingTeams]
            );
            registrationData = result.rows[0];

        } else if (configType === "shinsa") {
            const testingFor = parameters.testing_for;

            const result = await query(
                `
                INSERT INTO ${SHINSA_REGISTRATION_TABLE} (
                    event_id, member_id, registration_date, testing_for
                )
                VALUES ($1, $2, $3, $4)
                RETURNING event_id, member_id, registration_date, testing_for
                `,
                [eventId, memberId, registeredDate, testingFor]
            );
            registrationData = result.rows[0];

        } else if (configType === "seminar") {
            const result = await query(
                `
                INSERT INTO ${SEMINAR_REGISTRATION_TABLE} (
                    event_id, member_id, registration_date
                )
                VALUES ($1, $2, $3)
                RETURNING event_id, member_id, registration_date
                `,
                [eventId, memberId, registeredDate]
            );
            registrationData = result.rows[0];

        } else {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Invalid config_type" })
            };
        }

        // Assign member to the event's linked payment if one exists and they haven't already paid it
        const eventResult = await query(
            `SELECT payment_id FROM events WHERE event_id = $1 LIMIT 1`,
            [eventId]
        );
        const paymentId = eventResult.rows[0]?.payment_id;
        if (paymentId) {
            const alreadyPaid = await query(
                `SELECT 1 FROM submitted_payments WHERE member_id = $1 AND payment_id = $2 LIMIT 1`,
                [memberId, paymentId]
            );
            if (alreadyPaid.rowCount === 0) {
                await query(
                    `
                    INSERT INTO assigned_payments (member_id, payment_id, assigned_on, due_status)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT DO NOTHING
                    `,
                    [memberId, paymentId, getCurrentTimeUTC(), "due"]
                );
            }
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Registered Event Successfully",
                config_type: configType,
                data: registrationData,
            })
        };

    } catch (err) {
        console.error("registerEvent error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};