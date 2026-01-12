// convex/auth.config.ts
// WorkOS authentication configuration for Convex
// 
// ⚠️ DISABLED: WorkOS authentication is currently disabled
// To enable WorkOS authentication:
// 1. Remove the "DISABLED" comment below
// 2. Uncomment the provider configuration code
// 3. Add WORKOS_CLIENT_ID to Convex environment variables
//
// WorkOS is optional - the app works without it

// const clientId = process.env.WORKOS_CLIENT_ID || "";

// DISABLED: Always return empty providers array (authentication disabled)
const authConfig = {
  providers: [], // Empty array - WorkOS authentication is disabled
};

// ENABLED VERSION (commented out - uncomment to enable):
// const authConfig = {
//   providers: clientId
//     ? [
//         {
//           type: "customJwt",
//           issuer: "https://api.workos.com/",
//           algorithm: "RS256",
//           applicationID: clientId,
//           jwks: `https://api.workos.com/sso/jwks/${clientId}`,
//         },
//         {
//           type: "customJwt",
//           issuer: `https://api.workos.com/user_management/${clientId}`,
//           algorithm: "RS256",
//           jwks: `https://api.workos.com/sso/jwks/${clientId}`,
//         },
//       ]
//     : [],
// };

export default authConfig;

