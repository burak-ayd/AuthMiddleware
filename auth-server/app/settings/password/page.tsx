import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?next=/settings/password");

  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1>Şifre Değiştir</h1>
      <p>{session.user.email}</p>
      <ChangePasswordForm />
      <p>
        <a href="/dashboard">← Dashboard'a dön</a>
      </p>
    </main>
  );
}