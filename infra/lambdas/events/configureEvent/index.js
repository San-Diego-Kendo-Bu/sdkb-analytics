const { query } = require("../../shared_utils/db");
const { normalizeGroups } = require("../../shared_utils/normalize_claim");

const TOURNAMENTS_TABLE = "tournaments";
const TOURNAMENT_DIVISION_PAYMENTS_TABLE = "tournament_division_payments";
const SHINSA_TABLE = "shinsa_exams";
const SEMINAR_TABLE = "seminars";
const SPECIAL_EVENTS_TABLE = "special_events";
const EVENTS_TABLE = "events";

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body || "{}");
        const eventId = parameters.event_id;

        // Dynamically detect event type from events table
        const eventResult = await query(
            `
            SELECT event_type
            FROM ${EVENTS_TABLE}
            WHERE event_id = $1
            LIMIT 1
            `,
            [eventId]
        );

        if (eventResult.rows.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({ error: "Event not found" })
            };
        }

        const configType = eventResult.rows[0].event_type;

        if (configType === "tournament") {
            const shinpanNeeded = parameters.shinpan_needed;
            const divisions = parameters.divisions ?? [];
            const teamsIncluded = parameters.teams_included;
            const paymentRequired = parameters.payment_required ?? false;
            const divisionPayments = parameters.division_payments ?? {};

            if (paymentRequired) {
                if (!Array.isArray(divisions) || divisions.length === 0) {
                    return {
                        statusCode: 400,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ error: "At least one division is required when payment is required." })
                    };
                }
                const missing = divisions.filter((d) => !divisionPayments[d]);
                if (missing.length > 0) {
                    return {
                        statusCode: 400,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ error: `A payment must be selected for: ${missing.join(", ")}` })
                    };
                }
            }

            const result = await query(
                `
                INSERT INTO ${TOURNAMENTS_TABLE} (
                    event_id,
                    shinpan_needed,
                    divisions,
                    teams_included,
                    payment_required
                )
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (event_id) DO UPDATE SET
                    shinpan_needed = EXCLUDED.shinpan_needed,
                    divisions = EXCLUDED.divisions,
                    teams_included = EXCLUDED.teams_included,
                    payment_required = EXCLUDED.payment_required
                RETURNING event_id, shinpan_needed, divisions, teams_included, payment_required
                `,
                [eventId, shinpanNeeded, divisions, teamsIncluded, paymentRequired]
            );

            await query(
                `DELETE FROM ${TOURNAMENT_DIVISION_PAYMENTS_TABLE} WHERE event_id = $1`,
                [eventId]
            );

            let divisionPaymentRows = [];
            if (paymentRequired && divisions.length > 0) {
                const paymentIds = divisions.map((d) => parseInt(divisionPayments[d], 10));
                const insertResult = await query(
                    `
                    INSERT INTO ${TOURNAMENT_DIVISION_PAYMENTS_TABLE} (event_id, division_name, payment_id)
                    SELECT $1, name, pid
                    FROM unnest($2::text[], $3::bigint[]) AS t(name, pid)
                    RETURNING division_name, payment_id
                    `,
                    [eventId, divisions, paymentIds]
                );
                divisionPaymentRows = insertResult.rows;
            }

            return {
                statusCode: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Configured Event Successfully",
                    config_type: configType,
                    data: {
                        ...result.rows[0],
                        division_payments: Object.fromEntries(
                            divisionPaymentRows.map((r) => [r.division_name, r.payment_id])
                        ),
                    },
                })
            };
        }

        if (configType === "shinsa") {
            const shinsaLevels = parameters.shinsa_levels;
            const externalSignupUrl = parameters.external_signup_url ?? null;

            const result = await query(
                `
                INSERT INTO ${SHINSA_TABLE} (
                    event_id,
                    shinsa_levels,
                    external_signup_url
                )
                VALUES ($1, $2, $3)
                ON CONFLICT (event_id) DO UPDATE SET
                    shinsa_levels = EXCLUDED.shinsa_levels,
                    external_signup_url = EXCLUDED.external_signup_url
                RETURNING event_id, shinsa_levels, external_signup_url
                `,
                [eventId, shinsaLevels, externalSignupUrl]
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
            const seminarGuests = parameters.seminar_guests;
            const bringYourLunch = parameters.bring_your_lunch;
            const externalSignupUrl = parameters.external_signup_url ?? null;

            const result = await query(
                `
                INSERT INTO ${SEMINAR_TABLE} (
                    event_id,
                    seminar_guests,
                    bring_your_lunch,
                    external_signup_url
                )
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (event_id) DO UPDATE SET
                    seminar_guests = EXCLUDED.seminar_guests,
                    bring_your_lunch = EXCLUDED.bring_your_lunch,
                    external_signup_url = EXCLUDED.external_signup_url
                RETURNING event_id, seminar_guests, bring_your_lunch, external_signup_url
                `,
                [eventId, seminarGuests, bringYourLunch, externalSignupUrl]
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

        if (configType === "special_event") {
            const bringYourLunch = parameters.bring_your_lunch;

            const result = await query(
                `
                INSERT INTO ${SPECIAL_EVENTS_TABLE} (
                    event_id,
                    bring_your_lunch
                )
                VALUES ($1, $2)
                ON CONFLICT (event_id) DO UPDATE SET
                    bring_your_lunch = EXCLUDED.bring_your_lunch
                RETURNING event_id, bring_your_lunch
                `,
                [eventId, bringYourLunch]
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