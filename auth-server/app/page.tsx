import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
      <h1>Auth Server</h1>
      <p>Self-hosted OAuth2 / OIDC provider with phone-based approval.</p>
      <ul>
        <li><Link href="/login">Sign in</Link></li>
        <li><Link href="/api/health">Health</Link></li>
        <li><Link href="/api/ready">Readiness</Link></li>
        <li><Link href="/.well-known/openid-configuration">OIDC discovery</Link></li>
      </ul>
    </main>
  );
}
