// WorkOS authentication configuration
// This file is optional - if WORKOS_CLIENT_ID is not set, Convex will show a warning
// but the app will still work. To remove the warning, either:
// 1. Set WORKOS_CLIENT_ID in Convex dashboard environment variables, OR
// 2. Delete or rename this file if you don't need WorkOS authentication

// Use optional chaining and provide empty config if env var is missing
const clientId = process.env.WORKOS_CLIENT_ID || "";

const authConfig = {
  providers: clientId
    ? [
        {
          type: "customJwt" as const,
          issuer: `https://api.workos.com/`,
          algorithm: "RS256" as const,
          jwks: `https://api.workos.com/sso/jwks/${clientId}`,
          applicationID: clientId,
        },
        {
          type: "customJwt" as const,
          issuer: `https://api.workos.com/user_management/${clientId}`,
          algorithm: "RS256" as const,
          jwks: `https://api.workos.com/sso/jwks/${clientId}`,
        },
      ]
    : [],
};

export default authConfig;
