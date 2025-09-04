import { userManager } from "./cognitoManager.js";

export async function signInLogic(){
    await userManager.signinRedirect({
        extraQueryParams: {
            identity_provider: "Google",
            prompt: "select_account" // always show account picker
        }
    });
}