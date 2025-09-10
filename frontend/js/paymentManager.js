import { createClient } from "https://esm.sh/@supabase/supabase-js";
const endpoint = 'https://gsriiicvvxzvidaakctw.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcmlpaWN2dnh6dmlkYWFrY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg0MjUsImV4cCI6MjA3MDcyNDQyNX0.GtHJ405NZAA8V2RQy1h6kz3wIrdraaOEXTKTentoePE';

const supabaseClient = createClient(endpoint,anon);

export async function createPayment(createdAt, paymentValue, dueDate, overduePenalty, eventId){
    console.log("Creating payment...");
    const { error } = await supabaseClient.from('Payments').insert({
        'created_at' : createdAt,
        'payment_value' : paymentValue,
        'due_date' : dueDate,
        'overdue_penalty' : overduePenalty,
        'event_id' : eventId
    });
    if(error){
        console.log(error);
    }else{
        console.log("Payment created successfully.");
    }
    return error;
}
