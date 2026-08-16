/**
 * /callback — OAuth code exchange.
 *
 * 1) Validate state matches cookie (CSRF guard).
 * 2) Read PKCE verifier from cookie.
 * 3) POST /api/oauth/token on auth-server (Basic auth).
 * 4) Store access_token in httpOnly cookie.
 * 5) Redirect to /me.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exchangeCode } from "@/lib/auth-client";
import { timingSafeEqual } from "@/lib/oauth-client";

export const dynamic = "force-dynamic";

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; state?: string; error?: string }>;
}) {
  const sp = await searchParams;
  if (sp.error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>OAuth error</h1>
        <p>{sp.error}</p>
      </main>
    );
  }
  if (!sp.code || !sp.state) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Bad callback</h1>
        <p>Missing code or state.</p>
      </main>
    );
  }

  const jar = await cookies();
  const expectedState = jar.get("demo_oauth_state")?.value;
  const verifier = jar.get("demo_pkce_verifier")?.value;
  if (!expectedState || !verifier) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Session expired</h1>
        <p>PKCE cookies not found. Try logging in again.</p>
      </main>
    );
  }
  if (!timingSafeEqual(expectedState, sp.state)) {
    return (
      <main style={{ padding: 32 }}>
        <h1>State mismatch</h1>
        <p>Possible CSRF — refusing to complete.</p>
      </main>
    );
  }

  // Clear PKCE cookies
  jar.delete("demo_oauth_state");
  jar.delete("demo_pkce_verifier");

  const redirectUri = `${process.env.DEMO_PUBLIC_URL ?? "https://demo.burakaydogan.tk"}/callback`;
  const tokens = await exchangeCode({
    code: sp.code,
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