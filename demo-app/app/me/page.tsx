/**
 * /me — Userinfo fetch (Bearer access_token) + simple dashboard.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { fetchUserInfo } from "@/lib/auth-client";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const jar = await cookies();
  const token = jar.get("demo_access_token")?.value;
  if (!token) redirect("/login");

  let user;
  try {
    user = await fetchUserInfo(token);
  } catch {
    // Token expired or invalid — clear and bounce.
    jar.delete("demo_access_token");
    redirect("/login");
  }

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Demo App — Protected</h1>
      <p>
        Signed in as <strong>{user.email}</strong>{" "}
        {user.email_verified && (
          <span style={{ color: "green" }}>(verified)</span>
        )}
      </p>
      <pre style={{ background: "#f4f4f4", padding: 12, borderRadius: 4 }}>
        {JSON.stringify(user, null, 2)}
      </pre>
      <p>
        <a href="/api/logout">Sign out</a>
      </p>
    </main>
  );
}