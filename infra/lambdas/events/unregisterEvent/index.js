const { getSupabase } = require("../../shared_utils/supabase");

const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGISTRATION_TABLE = "Registrations";
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
        const memberId = parameters.member_id;

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);

        const response = await supabase
            .from(REGISTRATION_TABLE)
            .delete()
            .match({ event_id: eventId, member_id: memberId });
        
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