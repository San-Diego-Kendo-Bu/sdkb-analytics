const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const TOURNAMENTS_TABLE = "Tournaments";
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

        const eventId = parameters.event_id;
        const shinpanNeeded = parameters.shinpanNeeded;
        const divisions = parameters.divisions;
        const teamsIncluded = parameters.teams_included;

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        const response = await supabase.from(TOURNAMENTS_TABLE).insert({
            event_id: eventId,
            shinpan_needed: shinpanNeeded,
            divisions: divisions,
            teams_included: teamsIncluded,
        });
        
        if(response.error){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error })
            }; 
        }

        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Configured Tournament Successfully",
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