import { userManager } from "../cognitoManager.js";
const DOMAIN = 'https://qh3c0tz6s9.execute-api.us-east-2.amazonaws.com';

export async function rdsRead(method, endpoint){
    try{
        const user = await userManager.getUser();

        const response = await fetch(`${DOMAIN}/${endpoint}`, {
            method : method,
            headers : {
                'Content-Type' : 'application/json',
                'Authorization' : `Bearer ${user.id_token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        console.log("Request succeeded");
        const data = await response.json();
        return data;

    }catch(error){
        console.log("Request failed: " + error);
        return null;
    }
}
export async function rdsWrite(method, endpoint, args){
    try{
        const user = await userManager.getUser();

        const response = await fetch(`${DOMAIN}/${endpoint}`, {
            method : method,
            headers : {
                'Content-Type' : 'application/json',
                'Authorization' : `Bearer ${user.id_token}`
            },
            body : JSON.stringify(args),
        });
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        console.log("Request succeeded");
        const data = await response.json();
        return data;

    }catch(error){
        console.log("Request failed: " + error);
        return null;
    }

}