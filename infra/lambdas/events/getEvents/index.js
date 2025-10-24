const { getSupabase } = require("../../shared_utils/supabase");

const EVENTS_TABLE = "Events";
const SUPABASE_SECRET_ID = process.env.SUPABASE_SECRET_ID;
const REGION = process.env.AWS_REGION;
const FIELDS = ["event_id", "event_date", "event_name", "event_type", "event_deadline", "created_at", "event_location", "payment_id"];

function dummyRegisteredUsers(){
    return ["admin@gmail.com", "user@gmail.com"];
}

function isRegisteredUser(clientEmail){
    return (dummyRegisteredUsers()[0] === clientEmail || dummyRegisteredUsers()[1] === clientEmail);
}

exports.handler = async (event) => {

    const clientEmail = event.headers["client_email"];

    if(!isRegisteredUser(clientEmail))
        return { statusCode: 403, body: "Forbidden" };

    try {

        const parameters = event.headers;
        const payload = {};

        for(const field of FIELDS){
            if(field in parameters){
                payload[field] = parameters[field];
            }
        }

        const supabase = await getSupabase(SUPABASE_SECRET_ID, REGION);
        const response = (Object.keys(payload).length === 0) ?
            await supabase.from(EVENTS_TABLE).select("*") :
            await supabase.from(EVENTS_TABLE).select("*").match(payload);

        if(response.error){
            return{
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: response.error }),
            };
        }

        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Event(s) retrieved successfully.",
                payload : payload,
                body: response.data,
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