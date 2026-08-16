/**
 * JWT signing/verification for OAuth2 access tokens (RS256).
 *
 * Keys come from PEM-encoded env vars (JWT_PRIVATE_KEY / JWT_PUBLIC_KEY).
 * Generate a keypair once with scripts/gen-jwt-keys.mjs and pin the keys
 * to a stable deployment — rotating the key invalidates all issued tokens.
 */
import {
  importPKCS8,
  importSPKI,
  SignJWT,
  jwtVerify,
  exportJWK,
  type JWK,
} from "jose";

const ISSUER = "auth.burakaydogan.tk";

let _cache:
  | { signKey: CryptoKey; verifyKey: CryptoKey; publicJwk: JWK }
  | null = null;

function pemEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not configured`);

  // Fast path: literal "\n" markers collapse to real PEM newlines.
  let pem = v.replace(/\\n/g, "\n");

  // Legacy path: the old gen-jwt-keys.mjs base64-encoded the PEM string.
  // If we don't see a PEM header, attempt one base64 decode to recover it.
  if (!/-----BEGIN (RSA )?(PRIVATE|PUBLIC) KEY-----/.test(pem)) {
    try {
      const decoded = Buffer.from(pem.replace(/\s+/g, ""), "base64").toString("utf8");
      if (/-----BEGIN (RSA )?(PRIVATE|PUBLIC) KEY-----/.test(decoded)) {
        pem = decoded;
      }
    } catch {
      // fall through with original value; jose will throw a clearer error.
    }
  }
  return pem;
}

async function loadKeys() {
  if (_cache) return _cache;
  const pkcs8 = pemEnv("JWT_PRIVATE_KEY");
  const spki = pemEnv("JWT_PUBLIC_KEY");

  const signKey = (await importPKCS8(pkcs8, "RS256")) as unknown as CryptoKey;
  const verifyKey = (await importSPKI(spki, "RS256")) as unknown as CryptoKey;
  const jwk = (await exportJWK(verifyKey)) as JWK;

  _cache = {
    signKey,
    verifyKey,
    publicJwk: {
      kty: jwk.kty,
      use: "sig",
      alg: "RS256",
      kid: jwk.kid ?? undefined,
      n: jwk.n,
      e: jwk.e,
    },
  };
  return _cache;
}

export type AccessTokenClaims = {
  sub: string;
  email: string;
  scope: string;
  client_id: string;
};

export async function signAccessToken(
  claims: AccessTokenClaims,
  ttlSeconds = 900,
): Promise<string> {
  const { signKey, publicJwk } = await loadKeys();
  return new SignJWT(claims as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid, typ: "at+jwt" })
    .setIssuer(ISSUER)
    .setAudience(claims.client_id)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(signKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { verifyKey } = await loadKeys();
  const { payload } = await jwtVerify(token, verifyKey, {
    issuer: ISSUER,
    algorithms: ["RS256"],
  });
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    scope: String(payload.scope),
    client_id: String(payload.client_id),
  };
}

export async function getJwks(): Promise<{ keys: JWK[] }> {
  const { publicJwk } = await loadKeys();
  return { keys: [publicJwk] };
}