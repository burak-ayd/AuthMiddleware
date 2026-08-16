/**
 * /api/logout — clear access_token cookie, redirect to /login.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  jar.delete("demo_access_token");
  redirect("/login");
}