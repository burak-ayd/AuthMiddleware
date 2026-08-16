/**
 * Traefik forwardAuth verification endpoint.
 *
 * Called by Traefik for every request to a protected upstream.
 * Behavior:
 *   - No session cookie -> 302 to <auth-host>/login?next=<original path>
 *   - Has valid session  -> 200, with X-Forwarded-User / X-Forwarded-Email headers
 *     so upstream apps can identify the authenticated user.
 *
 * Traefik forwardAuth sets these request headers (when trustForwardHeader=true):
 *   X-Forwarded-Method, X-Forwarded-Proto, X-Forwarded-Host, X-Forwarded-Uri,
 *   X-Forwarded-For, X-Real-Ip.
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

function safeNext(raw: string | null): string {
  // Only accept same-origin relative paths (starting with "/" but not "//").
  // Block absolute URLs to prevent open-redirect.
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function authHostFrom(req: NextRequest): { proto: string; host: string } {
  // Prefer the public host Traefik forwarded; fall back to the Host header.
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "auth.burakaydogan.tk";
  return { proto, host };
}

async function handle(req: NextRequest) {
  const originalPath = safeNext(
    req.headers.get("x-forwarded-uri") ?? req.headers.get("x-original-url"),
  );

  const session = await auth();
  if (!session?.user?.id) {
    const { proto, host } = authHostFrom(req);
    const loginUrl = `${proto}://${host}/login?next=${encodeURIComponent(originalPath)}`;
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