/**
 * /callback — OAuth code exchange (Route Handler).
 *
 * Validates state, exchanges code for access_token via auth-server,
 * stores access_token in an httpOnly cookie, and 302s to /me.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exchangeCode } from "@/lib/auth-client";
import { timingSafeEqual } from "@/lib/oauth-client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const error = sp.get("error");

  if (error) {
    return new Response(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const jar = await cookies();
  const expectedState = jar.get("demo_oauth_state")?.value;
  const verifier = jar.get("demo_pkce_verifier")?.value;
  if (!expectedState || !verifier) {
    return new Response("PKCE cookies not found. Try logging in again.", { status: 400 });
  }
  if (!timingSafeEqual(expectedState, state)) {
    return new Response("State mismatch — possible CSRF.", { status: 400 });
  }

  // Clear PKCE cookies
  jar.delete("demo_oauth_state");
  jar.delete("demo_pkce_verifier");

  const redirectUri = `${process.env.DEMO_PUBLIC_URL ?? "https://demo.burakaydogan.tk"}/callback`;
  const tokens = await exchangeCode({
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  jar.set("demo_access_token", tokens.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in,
  });

  redirect("/me");
}