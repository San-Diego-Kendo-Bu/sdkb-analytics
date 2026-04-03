const { query } = require("../../shared_utils/db");
const { verifyMemberExists } = require("../../shared_utils/members");

const TOURNAMENT_REGISTRATION_TABLE = "tournament_registrations";
const SHINSA_REGISTRATION_TABLE = "shinsa_registrations";
const SEMINAR_REGISTRATION_TABLE = "seminar_registrations";

exports.handler = async (event) => {
    try {
        const parameters = JSON.parse(event.body || "{}");

        const configType = parameters.config_type;
        const eventId = parameters.event_id;
        const memberId = parameters.member_id;
        const registeredDate = parameters.registered_date;

        const memberExists = await verifyMemberExists(memberId);
        if (!memberExists) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Member not found" })
            };
        }

        if (configType === "tournament") {
            const shinpanning = parameters.shinpanning;
            const division = parameters.division;
            const doingTeams = parameters.doing_teams;

            const result = await query(
                `
                INSERT INTO ${TOURNAMENT_REGISTRATION_TABLE} (
                    event_id,
                    member_id,
                    registered_date,
                    shinpanning,
                    division,
                    doing_teams
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING
                    event_id,
                    member_id,
                    registered_date,
                    shinpanning,
                    division,
                    doing_teams
                `,
                [eventId, memberId, registeredDate, shinpanning, division, doingTeams]
            );

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Registered Event Successfully",
                    config_type: configType,
                    data: result.rows[0],
                })
            };
        }

        if (configType === "shinsa") {
            const testingFor = parameters.testing_for;

            const result = await query(
                `
                INSERT INTO ${SHINSA_REGISTRATION_TABLE} (
                    event_id,
                    member_id,
                    registered_date,
                    testing_for
                )
                VALUES ($1, $2, $3, $4)
                RETURNING
                    event_id,
                    member_id,
                    registered_date,
                    testing_for
                `,
                [eventId, memberId, registeredDate, testingFor]
            );

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Registered Event Successfully",
                    config_type: configType,
                    data: result.rows[0],
                })
            };
        }

        if (configType === "seminar") {
            const result = await query(
                `
                INSERT INTO ${SEMINAR_REGISTRATION_TABLE} (
                    event_id,
                    member_id,
                    registered_date
                )
                VALUES ($1, $2, $3)
                RETURNING
                    event_id,
                    member_id,
                    registered_date
                `,
                [eventId, memberId, registeredDate]
            );

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Registered Event Successfully",
                    config_type: configType,
                    data: result.rows[0],
                })
            };
        }

        return {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Invalid config_type" })
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