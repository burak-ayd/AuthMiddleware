/**
 * Traefik forwardAuth verification endpoint.
 *
 * Called by Traefik for every request to a protected upstream.
 * Behavior:
 *   - No session cookie -> 302 to /login?next=<original URL>
 *   - Has valid session  -> 200, with X-Forwarded-User / X-Forwarded-Email headers
 *     so upstream apps can identify the authenticated user.
 *
 * Note: Traefik sets X-Forwarded-Method, X-Forwarded-Proto, X-Forwarded-Host,
 * X-Forwarded-Uri in the request.
 */
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  const originalUrl =
    req.headers.get("x-forwarded-uri") ??
    req.headers.get("x-original-url") ??
    "/";

  const session = await auth();
  if (!session?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", originalUrl);
    return NextResponse.redirect(loginUrl, { status: 302 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "X-Forwarded-User": session.user.id,
      "X-Forwarded-Email": session.user.email ?? "",
    },
  });
}