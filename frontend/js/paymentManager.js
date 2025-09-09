const endpoint = 'https://gsriiicvvxzvidaakctw.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzcmlpaWN2dnh6dmlkYWFrY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDg0MjUsImV4cCI6MjA3MDcyNDQyNX0.GtHJ405NZAA8V2RQy1h6kz3wIrdraaOEXTKTentoePE';
export function dummy(){
    console.log("Dummy!");
}
export async function createPayment(){
    console.log("Creating payment...");
    try{
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey' : anon,
            },
            body: JSON.stringify({
                payment_id : 0,
                created_at : '2025-09-09',
                payment_value : 0,
                due_date : 0,
                overdue_penalty : 0,
                event_id : 0 
            })
        });
        
        if (!response.ok) {
            throw new Error(`Database returned returned ${response.status}`);
        }

        console.log("Payment created successful");
    
    }catch(err){
        console.log(err);
    }
}
