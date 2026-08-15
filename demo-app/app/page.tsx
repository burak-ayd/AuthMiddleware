// Minimal demo app placeholder. Real OAuth callback handler added in Phase 7.
export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Demo App</h1>
      <p>Protected by auth-gateway middleware. Should not be reachable without login.</p>
    </main>
  );
}
