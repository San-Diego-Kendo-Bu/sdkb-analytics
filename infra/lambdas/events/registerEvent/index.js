const { query } = require("../../shared_utils/db");
const { verifyMemberExists } = require("../../shared_utils/members");
const { resolveActingMemberId, canActFor } = require("../../shared_utils/families");
const { getCurrentTimeUTC } = require("../../shared_utils/dates");

const TOURNAMENT_REGISTRATION_TABLE = "tournament_registrations";
const SHINSA_REGISTRATION_TABLE = "shinsa_registrations";
const SEMINAR_REGISTRATION_TABLE = "seminar_registrations";
const SPECIAL_EVENT_REGISTRATION_TABLE = "special_event_registrations";

exports.handler = async (event) => {
    try {
        const claims =
            event.requestContext?.authorizer?.jwt?.claims ??
            event.requestContext?.authorizer?.claims ?? {};

        const parameters = JSON.parse(event.body || "{}");

        const configType = parameters.config_type;
        const eventId = parameters.event_id;
        const memberId = parameters.member_id;
        const registeredDate = parameters.registration_date;

        const actingMemberId = await resolveActingMemberId(claims);
        if (actingMemberId == null) {
            return {
                statusCode: 401,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Could not identify the logged-in member" })
            };
        }
        if (!(await canActFor(actingMemberId, memberId))) {
            return {
                statusCode: 403,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Not authorized to register this member" })
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

        const eventRow = await query(
            `SELECT event_date, event_deadline FROM events WHERE event_id = $1 LIMIT 1`,
            [eventId]
        );
        if (eventRow.rowCount === 0) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Event not found" })
            };
        }
        if (new Date() >= new Date(eventRow.rows[0].event_date)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Registration is closed: the event has already started." })
            };
        }
        if (eventRow.rows[0].event_deadline && new Date() > new Date(eventRow.rows[0].event_deadline)) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Registration is closed: the sign-up deadline has passed." })
            };
        }

        let registrationData;
        let divisionPaymentId = null;

        if (configType === "tournament") {
            const shinpanning = parameters.shinpanning;
            const divisions = parameters.divisions ?? [];
            const doingTeams = parameters.doing_teams;
            const weight = parameters.weight ?? null;
            const height = parameters.height ?? null;
            const age = parameters.age ?? null;

            const tournResult = await query(
                `SELECT payment_required FROM tournaments WHERE event_id = $1 LIMIT 1`,
                [eventId]
            );
            const paymentRequired = tournResult.rows[0]?.payment_required ?? false;

            if (paymentRequired) {
                if (divisions.length !== 1) {
                    return {
                        statusCode: 400,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ error: "Please select exactly one division." })
                    };
                }
                const dpResult = await query(
                    `SELECT payment_id FROM tournament_division_payments WHERE event_id = $1 AND division_name = $2 LIMIT 1`,
                    [eventId, divisions[0]]
                );
                if (dpResult.rowCount === 0) {
                    return {
                        statusCode: 400,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ error: "No payment is configured for the selected division." })
                    };
                }
                divisionPaymentId = dpResult.rows[0].payment_id;
            }

            const result = await query(
                `
                INSERT INTO ${TOURNAMENT_REGISTRATION_TABLE} (
                    event_id, member_id, registration_date, shinpanning, divisions, doing_teams, weight, height, age, payment_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
                `,
                [eventId, memberId, registeredDate, shinpanning, divisions, doingTeams, weight, height, age, divisionPaymentId]
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

        } else if (configType === "special_event") {
            const result = await query(
                `
                INSERT INTO ${SPECIAL_EVENT_REGISTRATION_TABLE} (
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

        // Assign member to the division's payment (tournaments with payment_required) or the
        // event's linked payment, whichever applies, if they haven't already paid it
        let paymentId = divisionPaymentId;
        if (!paymentId) {
            const eventResult = await query(
                `SELECT payment_id FROM events WHERE event_id = $1 LIMIT 1`,
                [eventId]
            );
            paymentId = eventResult.rows[0]?.payment_id;
        }
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