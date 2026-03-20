import { userManager } from "../cognitoManager";

async function fetchPayments(){
    try{
        const user = await userManager.getUser();

        const response = await fetch('https://jlsml5sfaj.execute-api.us-east-2.amazonaws.com/payments', {
            method: 'GET',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization' : `Bearer ${user.id_token}`
            }
        });

        console.log("Payments retrieved successfully.");
        const data = await response.json();
        console.log(data);
    }catch (error){
        console.log("Failed to retrieve payments.");
        console.log(error);
    }
}

export {
    fetchPayments
}