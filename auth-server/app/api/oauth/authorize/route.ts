/**
 * OAuth2 / OIDC Authorization Endpoint.
 *
 * Phase 3a: no phone approval flow yet. If the user is signed in we
 * immediately mint an authorization code and 302 to client.redirect_uri.
 * Phase 3b will insert a PendingApproval step here.
 *
 * Validates:
 *   - client_id (must exist, redirect_uri exact-match against client's list)
 *   - response_type=code (only Authorization Code flow)
 *   - scope (openid / profile / email)
 *   - state (echoed back)
 *   - code_challenge + code_challenge_method=S256 (PKCE)
 *
 * If the user has no session: redirect to /login?next=<this URL with all params>.
 */
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseScope, randomToken } from "@/lib/oauth";

export const dynamic = "force-dynamic";

type Params = {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
};

function buildAuthorizePath(req: NextRequest, params: Params): string {
  // Reconstruct the path + query so the user returns here after login.
  const sp = req.nextUrl.searchParams;
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out.set(k, v);
  }
  return `/api/oauth/authorize?${out.toString()}`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params: Params = {
    client_id: sp.get("client_id") ?? undefined,
    redirect_uri: sp.get("redirect_uri") ?? undefined,
    response_type: sp.get("response_type") ?? undefined,
    scope: sp.get("scope") ?? undefined,
    state: sp.get("state") ?? undefined,
    code_challenge: sp.get("code_challenge") ?? undefined,
    code_challenge_method: sp.get("code_challenge_method") ?? undefined,
    nonce: sp.get("nonce") ?? undefined,
  };

  // 1. Validate required params
  if (!params.client_id || !params.redirect_uri || !params.response_type) {
    return new NextResponse("invalid_request: missing required parameter", {
      status: 400,
    });
  }
  if (params.response_type !== "code") {
    return new NextResponse("unsupported_response_type: only 'code' supported", {
      status: 400,
    });
  }
  if (!params.code_challenge || params.code_challenge_method !== "S256") {
    return new NextResponse("invalid_request: PKCE code_challenge (S256) required", {
      status: 400,
    });
  }

  // 2. Validate client
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: params.client_id },
  });
  if (!client) {
    return new NextResponse("invalid_client: unknown client_id", { status: 400 });
  }
  if (!client.redirectUris.includes(params.redirect_uri)) {
    return new NextResponse(
      `invalid_request: redirect_uri not registered (allowed: ${client.redirectUris.join(", ")})`,
      { status: 400 },
    );
  }

  // 3. Scope
  const scope = parseScope(params.scope);

  // 4. Session
  const session = await auth();
  if (!session?.user?.id) {
    // Bounce through /login, preserving the OAuth params on the way back.
    redirect(`/login?next=${encodeURIComponent(buildAuthorizePath(req, params))}`);
  }

  // 5. Mint authorization code (single-use, 60s TTL)
  const code = randomToken(32);
  const expiresAt = new Date(Date.now() + 60_000);

  await prisma.oAuthCode.create({
    data: {
      code,
      clientId: client.clientId,
      userId: session.user.id,
      redirectUri: params.redirect_uri,
      scope,
      codeChallenge: params.code_challenge,
      codeChallengeMethod: params.code_challenge_method ?? "S256",
      expiresAt,
    },
  });

  // 6. Redirect back to client with code (+state)
  const url = new URL(params.redirect_uri);
  url.searchParams.set("code", code);
  if (params.state) url.searchParams.set("state", params.state);
  redirect(url.toString());
}