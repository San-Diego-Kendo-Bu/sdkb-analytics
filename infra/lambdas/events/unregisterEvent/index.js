const { getSupabase } = require("../../shared_utils/supabase");
const { verifyMemberExists } = require("../../shared_utils/members");
const { normalizeGroups } = require("../../shared_utils/utils");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const TOURNAMENT_REGISTRATION_TABLE = "Registrations";
const SHINSA_REGISTRATION_TABLE = "ShinsaRegistrations";
const SEMINAR_REGISTRATION_TABLE = "SeminarRegistrations";
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
        const configType = parameters.config_type;
        const eventId = parameters.event_id;
        const memberId = parameters.member_id;

        const memberExists = await verifyMemberExists(memberId);
        if (!memberExists) {
            return {
                statusCode: 404,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Member not found" })
            };
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        if (configType === "tournament") {
            const response = await supabase
                .from(TOURNAMENT_REGISTRATION_TABLE)
                .delete()
                .match({ event_id: eventId, member_id: memberId });

            if (response.error) {
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: response.error })
                };
            }
        } else if (configType === "shinsa") {
            const response = await supabase
                .from(SHINSA_REGISTRATION_TABLE)
                .delete()
                .match({ event_id: eventId, member_id: memberId });

            if (response.error) {
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: response.error })
                };
            }

        } else if (configType === "seminar") {
            const response = await supabase
                .from(SEMINAR_REGISTRATION_TABLE)
                .delete()
                .match({ event_id: eventId, member_id: memberId });

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
                message: "Event Unregistered Successfully",
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