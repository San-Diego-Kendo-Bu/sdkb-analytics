import { userManager } from "./cognitoManager.js";

export async function setButtonsDisplay() {
    console.log("From button logic");
    const user = await userManager.getUser();
    
    const signOut = document.getElementById("signOut");
    const signIn = document.getElementById("signIn");

    signOut.style.display = (user && !user.expired) ? "inline" : "none";
    signIn.style.display = (user && !user.expired) ? "none" : "inline";
    
    if(!user || user.expired) return;

    try {
        const response = await fetch('https://j5z43ef3j0.execute-api.us-east-2.amazonaws.com/admins',{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.id_token}`
            }
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        const data = await response.json();
        //console.log(data);
        
        if(!data.isAdmin) return;
        
        const addDropdownButton = document.getElementById('addDropdownButton');
        const removeDropdownButton = document.getElementById('removeDropdownButton');
        const searchDropdownButton = document.getElementById('searchDropdownButton');

        addDropdownButton.style.display = "inline";
        removeDropdownButton.style.display = "inline";
        searchDropdownButton.style.display = "inline";
        
    } catch (error) {
        console.error(error);
    }
}

export async function signInLogic(){
    await userManager.signinRedirect({
        extraQueryParams: {
            identity_provider: "Google",
            prompt: "select_account" // always show account picker
        }
    });
}

export async function signOutLogic(){
    const user = await userManager.getUser();
    if (user) {
        console.log("Logging out user:", user);
        sessionStorage.removeItem("access-token-stored");
        await userManager.removeUser(); // remove from storage
    } else {
        console.warn("No user found in session.");
    }
    window.location.reload();
}