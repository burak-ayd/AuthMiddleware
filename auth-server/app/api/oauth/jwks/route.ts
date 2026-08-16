/**
 * Public JWKS — clients fetch the auth-server's RS256 public key here to
 * verify access token signatures. Cache-Control: public, immutable because
 * the key is rotated manually (no kid rotation yet).
 */
import { getJwks } from "@/lib/jwt";

export const dynamic = "force-dynamic";

export async function GET() {
  const jwks = await getJwks();
  return Response.json(jwks, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}