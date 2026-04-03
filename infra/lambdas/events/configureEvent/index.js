const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const TOURNAMENTS_TABLE = "tournaments";
const SHINSA_TABLE = "shinsa_exams";
const SEMINAR_TABLE = "seminars";

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const configType = parameters.config_type;

        if (configType === "tournament") {
            const eventId = parameters.event_id;
            const shinpanNeeded = parameters.shinpan_needed;
            const divisions = parameters.divisions;
            const teamsIncluded = parameters.teams_included;

            const result = await query(
                `
                INSERT INTO ${TOURNAMENTS_TABLE} (
                    event_id,
                    shinpan_needed,
                    divisions,
                    teams_included
                )
                VALUES ($1, $2, $3, $4)
                RETURNING event_id, shinpan_needed, divisions, teams_included
                `,
                [eventId, shinpanNeeded, divisions, teamsIncluded]
            );

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Configured Event Successfully",
                    config_type: configType,
                    data: result.rows[0],
                })
            };
        }

        if (configType === "shinsa") {
            const eventId = parameters.event_id;
            const shinsaLevels = parameters.shinsa_levels;

            const result = await query(
                `
                INSERT INTO ${SHINSA_TABLE} (
                    event_id,
                    shinsa_levels
                )
                VALUES ($1, $2)
                RETURNING event_id, shinsa_levels
                `,
                [eventId, shinsaLevels]
            );

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Configured Event Successfully",
                    config_type: configType,
                    data: result.rows[0],
                })
            };
        }

        if (configType === "seminar") {
            const eventId = parameters.event_id;
            const seminarGuests = parameters.seminar_guests;
            const bringYourLunch = parameters.bring_your_lunch;

            const result = await query(
                `
                INSERT INTO ${SEMINAR_TABLE} (
                    event_id,
                    seminar_guests,
                    bring_your_lunch
                )
                VALUES ($1, $2, $3)
                RETURNING event_id, seminar_guests, bring_your_lunch
                `,
                [eventId, seminarGuests, bringYourLunch]
            );

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Configured Event Successfully",
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
        console.error("configureEvent error:", err);

        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: err.message })
        };
    }
};