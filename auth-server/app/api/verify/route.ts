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

function pathFromForwardedUri(raw: string | null): string {
  // Traefik X-Forwarded-Uri genelde relative path (/api/...) döndürür ama
  // bazı konfigürasyonlarda full URL (https://host/...) gelebilir.
  // Her durumda sadece path + query'yi al.
  if (!raw) return "/";
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw);
    return u.pathname + u.search;
  } catch {
    return "/";
  }
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
  // Use x-forwarded-uri's path so the next= param is a same-origin relative.
  const originalPath = safeNext(
    pathFromForwardedUri(
      req.headers.get("x-forwarded-uri") ??
        req.headers.get("x-original-url"),
    ),
  );

  const session = await auth();
  if (!session?.user?.id) {
    const { proto, host } = authHostFrom(req);
    // We redirect to the UPSTREAM host (e.g. demo.burakaydogan.tk) so the
    // user's browser reaches the protected app's own /login shim, which
    // in turn kicks off the OAuth flow. The upstream app reads the
    // original path from `next` and resumes there after login.
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