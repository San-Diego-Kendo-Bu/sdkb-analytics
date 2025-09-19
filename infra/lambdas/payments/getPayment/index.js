const { createClient } = require("@supabase/supabase-js");
const ENDPOINT = 'https://gsriiicvvxzvidaakctw.supabase.co';
const PAYMENTS_TABLE = "Payments";
const ANON = process.env.ANON;

function dummyRegisteredUsers(){
    return ['admin@gmail.com', 'user@gmail.com'];
}

function isRegisteredUser(clientEmail){
    return (dummyRegisteredUsers()[0] === clientEmail || dummyRegisteredUsers()[1] === clientEmail);
}

async function getSupabase(){
    const supabase = createClient(ENDPOINT, ANON);
    return supabase;
}

exports.handler = async (event) => {

    const clientEmail = event.headers["client_email"];
    
    if(!isRegisteredUser(clientEmail))
        return { statusCode: 403, body: "Forbidden" };

    try {
        
        const parameters = JSON.parse(event.body);
        const payload = {};

        if(parameters.payment_id !== undefined) payload.payment_id = parameters.payment_id;
        if(parameters.title !== undefined) payload.title = parameters.title;
        if(parameters.created_at !== undefined) payload.created_at = parameters.created_at;
        if(parameters.due_date !== undefined) payload.due_date = parameters.due_date;
        if(parameters.payment_value !== undefined) payload.payment_value = parameters.payment_value;
        if(parameters.overdue_penalty !== undefined) payload.overdue_penalty = parameters.overdue_penalty;
        if(parameters.event_id !== undefined) payload.event_id = parameters.event_id;

        const supabase = await getSupabase();
        const response = (Object.keys(payload).length === 0) ? 
            await supabase.from(PAYMENTS_TABLE).select('*') :
            await supabase.from(PAYMENTS_TABLE).select('*').match(payload);

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
                message: "Payment(s) retrieved successfully",
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