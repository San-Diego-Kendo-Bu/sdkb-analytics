import { UserManager } from "oidc-client-ts";

const cognitoDomain = "https://us-east-2poklryknt.auth.us-east-2.amazoncognito.com";
const clientId      = "7uqje135h2m1tu0t1j2bdasgq3";
const userPoolId    = "us-east-2_pOKlRyKnT";
const redirectUri   = "https://d3j7mmciz70vi1.cloudfront.net/callback.html";

export const userManager = new UserManager({
  authority: cognitoDomain,             // Hosted UI domain
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: "code",
  response_mode: "query",
  scope: "openid email profile",
  metadata: {
    issuer:               `https://cognito-idp.us-east-2.amazonaws.com/${userPoolId}`,
    authorization_endpoint: `${cognitoDomain}/oauth2/authorize`,
    token_endpoint:         `${cognitoDomain}/oauth2/token`,
    userinfo_endpoint:      `${cognitoDomain}/oauth2/userinfo`,   // lowercase
    end_session_endpoint:   `${cognitoDomain}/logout`,
    jwks_uri:               `https://cognito-idp.us-east-2.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  },
});
