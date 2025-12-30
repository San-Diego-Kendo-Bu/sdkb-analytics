const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const TOURNAMENTS_TABLE = "Tournaments";
const SHINSA_TABLE = "Shinsas";
const SEMINAR_TABLE = "Seminars";
const REGION = process.env.AWS_REGION;

exports.handler = async (event) => {
    const claims =
        event.requestContext?.authorizer?.jwt?.claims ??
        event.requestContext?.authorizer?.claims ?? {};

    const groups = normalizeGroups(claims["cognito:groups"]);
    const isAdmin = groups.some((g) => g === "admins" || g.endsWith(" admins"));
    if (!isAdmin) return { statusCode: 403, body: "Forbidden" };

    try {

        const parameters = JSON.parse(event.body);

        // parse out if this is a shinsa or tournament or seminar configuration
        const configType = parameters.config_type;
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        if (configType === "tournament") {
            const eventId = parameters.event_id;
            const shinpanNeeded = parameters.shinpan_needed;
            const divisions = parameters.divisions;
            const teamsIncluded = parameters.teams_included;

            const response = await supabase.from(TOURNAMENTS_TABLE).insert({
                event_id: eventId,
                shinpan_needed: shinpanNeeded,
                divisions: divisions,
                teams_included: teamsIncluded,
            });

            if (response.error) {
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: response.error })
                };
            }
        } else if (configType === "shinsa") {
            const eventId = parameters.event_id;
            const shinsaLevels = parameters.shinsa_levels;

            const response = await supabase.from(SHINSA_TABLE).insert({
                event_id: eventId,
                shinsa_levels: shinsaLevels,
            });

            if (response.error) {
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: response.error })
                };
            }
        } else if (configType === "seminar") {
            const eventId = parameters.event_id;
            const seminarGuests = parameters.seminar_guests;
            const bring_your_lunch = parameters.bring_your_lunch;

            const response = await supabase.from(SEMINAR_TABLE).insert({
                event_id: eventId,
                seminar_guests: seminarGuests,
                bring_your_lunch: bring_your_lunch,

            });

            if (response.error) {
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: response.error })
                };
            }
        } else {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Invalid config_type" })
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Configured Event Successfully",
                request_parameters: parameters,
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