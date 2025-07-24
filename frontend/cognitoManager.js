import { UserManager } from "https://cdn.skypack.dev/oidc-client-ts";

// This is the Hosted UI domain, NOT the Cognito IDP endpoint
const cognitoDomain = "https://us-east-2poklryknt.auth.us-east-2.amazoncognito.com";
const clientId = "7uqje135h2m1tu0t1j2bdasgq3";

// Replace with your actual S3 static site URL
const redirectUri = "https://d3j7mmciz70vi1.cloudfront.net/callback.html";
const logoutUri = "https://d3j7mmciz70vi1.cloudfront.net/";

export const userManager = new UserManager({
    authority: cognitoDomain,
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email phone",
    authority: cognitoDomain,
    metadata: {
        issuer: cognitoDomain,
        authorization_endpoint: `${cognitoDomain}/oauth2/authorize`,
        token_endpoint: `${cognitoDomain}/oauth2/token`,
        userinfo_endpoint: `${cognitoDomain}/oauth2/userInfo`,
        end_session_endpoint: `${cognitoDomain}/logout`,
    }
});

export function signOutRedirect() {
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
}
