/**
 * OAuth2 helpers: PKCE, scope, code/challenge generation.
 */
import { createHash, randomBytes } from "node:crypto";

export const SUPPORTED_SCOPES = ["openid", "profile", "email"] as const;
export type Scope = (typeof SUPPORTED_SCOPES)[number];

/** RFC 7636 — verify a code_verifier against the stored code_challenge. */
export function verifyPkce(
  verifier: string,
  challenge: string,
  method: "S256" | "plain" | null,
): boolean {
  if (!verifier || !challenge) return false;
  if (method === "S256" || (!method && challenge.length >= 43)) {
    const hashed = createHash("sha256").update(verifier).digest("base64url");
    return timingSafeEqualStr(hashed, challenge);
  }
  // "plain" — RFC 7636 deprecated; allow only if explicitly requested.
  return timingSafeEqualStr(verifier, challenge);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** Parse a space-separated scope string, validate, return joined canonical form. */
export function parseScope(raw: string | null | undefined): string {
  if (!raw) return "openid";
  const tokens = raw.split(/\s+/).filter(Boolean);
  const valid = tokens.filter((t): t is Scope =>
    (SUPPORTED_SCOPES as readonly string[]).includes(t),
  );
  return valid.length > 0 ? Array.from(new Set(valid)).join(" ") : "openid";
}

/** Random URL-safe token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Refresh tokens are opaque (high-entropy), stored hashed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}