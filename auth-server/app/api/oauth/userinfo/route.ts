/**
 * OIDC UserInfo endpoint — Bearer JWT access token ile kullanıcı bilgisi.
 *
 * Scope'a göre claim'ler:
 *   - openid  -> sub
 *   - email   -> email, email_verified
 *   - profile -> name
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAccessToken } from "@/lib/jwt";

export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse(JSON.stringify({ error: "invalid_token" }), {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Bearer error="invalid_token"',
      "Content-Type": "application/json",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();
  const token = auth.slice(7);

  let claims;
  try {
    claims = await verifyAccessToken(token);
  } catch {
    return unauthorized();
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) return unauthorized();

  const scopes = new Set(claims.scope.split(/\s+/));
  const out: Record<string, unknown> = {};
  if (scopes.has("openid")) out.sub = user.id;
  if (scopes.has("email")) {
    out.email = user.email;
    out.email_verified = true;
  }
  if (scopes.has("profile") && user.displayName) {
    out.name = user.displayName;
  }
  return NextResponse.json(out);
}