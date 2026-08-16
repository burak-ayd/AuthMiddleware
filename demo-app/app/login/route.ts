/**
 * /login — Route Handler (NOT page) so cookies can be mutated.
 *
 * Generates PKCE verifier/challenge + state, stores them in short-lived
 * cookies, and 302s the browser to the auth-server's authorize endpoint.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { generatePkce, generateState } from "@/lib/oauth-client";
import { authorizeUrl } from "@/lib/auth-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const { verifier, challenge } = generatePkce();
  const state = generateState();

  jar.set("demo_pkce_verifier", verifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/callback",
    maxAge: 120,
  });
  jar.set("demo_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/callback",
    maxAge: 120,
  });

  const redirectUri = `${process.env.DEMO_PUBLIC_URL ?? "https://demo.burakaydogan.tk"}/callback`;
  redirect(
    authorizeUrl({
      redirect_uri: redirectUri,
      state,
      code_challenge: challenge,
    }),
  );
}