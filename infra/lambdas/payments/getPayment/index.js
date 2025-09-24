const { createClient } = require("@supabase/supabase-js");
const ENDPOINT = 'https://gsriiicvvxzvidaakctw.supabase.co';
const PAYMENTS_TABLE = "Payments";
const ANON = process.env.ANON;
const FIELDS = ['payment_id', 'title', 'created_at', 'due_date', 'payment_value', 'overdue_penalty', 'event_id'];

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

        for(const field of FIELDS){
            if(field in parameters){
                payload[field] = parameters[field];
            }
        }

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
                message: "Payment(s) retrieved successfully.",
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