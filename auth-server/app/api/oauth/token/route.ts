/**
 * OAuth2 / OIDC Token Endpoint.
 *
 * Phase 3a supports ONLY grant_type=authorization_code + PKCE.
 * Returns a signed RS256 access_token (15 min). No refresh_token yet —
 * clients re-authorize after expiry. Refresh token rotation lands in Phase 3b.
 *
 * Confidential client auth: HTTP Basic auth (client_id:client_secret).
 */
import { NextResponse, type NextRequest } from "next/server";
import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { verifyPkce, parseScope } from "@/lib/oauth";
import { signAccessToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

function jsonError(code: string, description: string, status = 400) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function parseBasicAuth(req: NextRequest): { clientId?: string; clientSecret?: string } {
  const h = req.headers.get("authorization");
  if (!h?.startsWith("Basic ")) return {};
  try {
    const decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return {};
    return { clientId: decoded.slice(0, idx), clientSecret: decoded.slice(idx + 1) };
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  // application/x-www-form-urlencoded per OAuth2 spec
  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("invalid_request", "body must be application/x-www-form-urlencoded");

  const grantType = String(form.get("grant_type") ?? "");
  const code = String(form.get("code") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeVerifier = String(form.get("code_verifier") ?? "");

  // Client authentication
  const { clientId: basicId, clientSecret } = parseBasicAuth(req);
  const clientId =
    basicId ?? String(form.get("client_id") ?? "");
  const clientSecretBody = String(form.get("client_secret") ?? "");
  const effectiveSecret = clientSecret ?? clientSecretBody;

  if (!grantType) return jsonError("invalid_request", "grant_type is required");
  if (grantType !== "authorization_code") {
    return jsonError("unsupported_grant_type", `grant_type=${grantType} not supported`);
  }
  if (!clientId || !effectiveSecret) {
    return jsonError("invalid_client", "client authentication required");
  }

  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client || !client.clientSecretHash) {
    return jsonError("invalid_client", "unknown client_id");
  }
  const ok = await argon2.verify(client.clientSecretHash, effectiveSecret);
  if (!ok) return jsonError("invalid_client", "client authentication failed");

  // Code lookup
  if (!code) return jsonError("invalid_request", "code is required");
  if (!redirectUri) return jsonError("invalid_request", "redirect_uri is required");
  if (!codeVerifier) return jsonError("invalid_request", "code_verifier is required (PKCE)");

  const stored = await prisma.oAuthCode.findUnique({ where: { code } });
  if (!stored) return jsonError("invalid_grant", "code not found");

  if (stored.consumedAt) return jsonError("invalid_grant", "code already used");
  if (stored.expiresAt.getTime() < Date.now()) {
    return jsonError("invalid_grant", "code expired");
  }
  if (stored.clientId !== client.clientId) {
    return jsonError("invalid_grant", "code was issued to a different client");
  }
  if (stored.redirectUri !== redirectUri) {
    return jsonError("invalid_grant", "redirect_uri mismatch");
  }
  if (
    !verifyPkce(
      codeVerifier,
      stored.codeChallenge ?? "",
      (stored.codeChallengeMethod as "S256" | "plain" | null) ?? null,
    )
  ) {
    return jsonError("invalid_grant", "PKCE verification failed");
  }

  // Consume code (single-use)
  await prisma.oAuthCode.update({
    where: { code },
    data: { consumedAt: new Date() },
  });

  // Resolve user
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) return jsonError("server_error", "user vanished", 500);

  const scope = parseScope(stored.scope);
  const accessToken = await signAccessToken(
    {
      sub: user.id,
      email: user.email,
      scope,
      client_id: client.clientId,
    },
    900, // 15 min
  );

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 900,
      scope,
    },
    { headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } },
  );
}