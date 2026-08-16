import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

async function handleSignOut() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/dashboard");

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Dashboard</h1>
      <p>
        Hoş geldin, <strong>{session.user.email}</strong>.
      </p>
      <ul>
        <li>
          <a href="/settings/password">Şifre değiştir</a>
        </li>
        <li>
          <form action={handleSignOut} style={{ display: "inline" }}>
            <button type="submit">Çıkış Yap</button>
          </form>
        </li>
      </ul>
    </main>
  );
}