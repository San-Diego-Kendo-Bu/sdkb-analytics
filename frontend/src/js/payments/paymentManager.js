import { userManager } from "../cognitoManager";

async function fetchPayments(){
    try{
        const user = await userManager.getUser();

        const response = await fetch('https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com/payments', {
            method: 'GET',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization' : `Bearer ${user.id_token}`
            }
        });

        console.log("Payments retrieved successfully.");
        const data = await response.json();
        console.log(data.message);
        console.log(data.data);
        return data;
    }catch (error){
        console.log("Failed to retrieve payments.");
        console.log(error);
        return null;
    }
}

export {
    fetchPayments
}