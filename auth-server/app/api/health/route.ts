// Health check endpoint for Docker / Coolify / Traefik
// Returns 200 if the Node process is alive. Does not check DB/Redis.
export async function GET() {
  return Response.json({ ok: true, service: "auth-server" });
}
