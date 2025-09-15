/**
 * TODO: 
 * 1. Change supabase policy so that only people with the service key can make changes to the supabase
 * 2. Use secret manager to allow this lambda to read the service key.
 */

const { createClient } = require("@supabase/supabase-js");
const ENDPOINT = 'https://gsriiicvvxzvidaakctw.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcmlpaWN2dnh6dmlkYWFrY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg0MjUsImV4cCI6MjA3MDcyNDQyNX0.GtHJ405NZAA8V2RQy1h6kz3wIrdraaOEXTKTentoePE';
const PAYMENTS_TABLE = "Payments"
 
exports.handler = async (event) => {
    try {
        const supabase = createClient(ENDPOINT, ANON);
        
        const parameters = JSON.parse(event.body);

        const createdAt = parameters.created_at;
        const dueDate = parameters.due_date;
        const paymentValue = parameters.payment_value ? parseFloat(parameters.payment_value) : null;
        const overduePenalty = parameters.overdue_penalty ? parseFloat(parameters.overdue_penalty) : null;
        const eventId = parameters.event_id ? parseInt(parameters.event_id, 10) : null;

        const { err } = await supabase.from(PAYMENTS_TABLE).insert({
            created_at: createdAt,
            due_date: dueDate,
            payment_value: paymentValue,
            overdue_penalty: overduePenalty,
            event_id: eventId
        });
        
        if(err){
            return {
                statusCode: 500,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: err.message })
            }; 
        }

        return{
            statusCode : 200,
            headers : {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body : JSON.stringify({
                message: "Created Payment Successfully",
                parameters: parameters
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