import { userManager } from "./cognitoManager.js";

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