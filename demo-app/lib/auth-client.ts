/**
 * Demo-app OAuth client: build the authorize URL and exchange the code
 * for an access token. Confidential client (Basic auth).
 *
 * AUTH_SERVER_URL must be the PUBLIC URL (e.g. https://auth.burakaydogan.tk)
 * because the authorize URL is sent to the user's browser. Server-side
 * token + userinfo calls go through Traefik too (slightly slower but
 * simpler than maintaining two URLs).
 */

const AUTH_URL = process.env.AUTH_SERVER_URL ?? "https://auth.burakaydogan.tk";
export const CLIENT_ID = process.env.DEMO_OAUTH_CLIENT_ID ?? "demo-app";
const CLIENT_SECRET = process.env.DEMO_OAUTH_CLIENT_SECRET ?? "";

export function authorizeUrl(params: {
  redirect_uri: string;
  state: string;
  code_challenge: string;
  scope?: string;
}): string {
  const u = new URL("/api/oauth/authorize", AUTH_URL);
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("redirect_uri", params.redirect_uri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", params.scope ?? "openid profile email");
  u.searchParams.set("state", params.state);
  u.searchParams.set("code_challenge", params.code_challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeCode(params: {
  code: string;
  redirect_uri: string;
  code_verifier: string;
}): Promise<{ access_token: string; expires_in: number; scope: string }> {
  const u = new URL("/api/oauth/token", AUTH_URL);
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirect_uri,
    code_verifier: params.code_verifier,
  });
  const res = await fetch(u.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function fetchUserInfo(accessToken: string): Promise<{
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}> {
  const u = new URL("/api/oauth/userinfo", AUTH_URL);
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return res.json();
}