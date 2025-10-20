const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const TOURNAMENT_REGISTRATION_TABLE = "Registrations";
const SHINSA_REGISTRATION_TABLE = "ShinsaRegistrations";
const SEMINAR_REGISTRATION_TABLE = "SeminarRegistrations";
const REGION = process.env.AWS_REGION;

function dummyCognito(){
    return ['admin@gmail.com'];
}

function isAdmin(clientEmail){
    return dummyCognito()[0] === clientEmail;
}

exports.handler = async (event) => {

    const clientEmail = event.headers["client_email"];
    
    if(!isAdmin(clientEmail))
        return { statusCode: 403, body: "Forbidden" };

    try {
        const parameters = JSON.parse(event.body);
        const configType = parameters.config_type;
        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        if (configType === "tournament") {
            const eventId = parameters.event_id;
            const memberId = parameters.member_id;
            const registered_date = parameters.registered_date;
            const shinpanning = parameters.shinpanning;
            const division = parameters.division;
            const doingTeams = parameters.doing_teams;

            const response = await supabase.from(TOURNAMENT_REGISTRATION_TABLE).insert({
                event_id: eventId,
                member_id: memberId,
                registered_date: registered_date,
                shinpanning: shinpanning,
                division: division,
                doing_teams: doingTeams
            });
            
            if(response.error){
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ error: response.error })
                }; 
            }
        } else if (configType === "shinsa") {
            const eventId = parameters.event_id;
            const memberId = parameters.member_id;
            const registered_date = parameters.registered_date;
            const testing_for = parameters.testing_for;

            const response = await supabase.from(SHINSA_REGISTRATION_TABLE).insert({
                event_id: eventId,
                member_id: memberId,
                registered_date: registered_date,
                testing_for: testing_for
            });

            if(response.error){
                return {
                    statusCode: 500,
                    headers: { "Content-Type": "application/json" },     
                    body: JSON.stringify({ error: response.error })
                };
            }
        } else if (configType === "seminar") {
            const eventId = parameters.event_id;
            const memberId = parameters.member_id;
            const registered_date = parameters.registered_date;

            const response = await supabase.from(SEMINAR_REGISTRATION_TABLE).insert({
                event_id: eventId,
                member_id: memberId,
                registered_date: registered_date
            });

            if(response.error){
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

        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Registered Event Successfully",
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