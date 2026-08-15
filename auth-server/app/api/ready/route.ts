// Readiness check — verifies DB and Redis are reachable
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function GET() {
  const checks: Record<string, string> = {};
  let ok = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch (e) {
    checks.db = "fail";
    ok = false;
  }

  try {
    await redis.ping();
    checks.redis = "ok";
  } catch {
    checks.redis = "fail";
    ok = false;
  }

  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
