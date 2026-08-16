import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

type SearchParams = { next?: string | string[] };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // If already signed in, skip the form.
  const session = await auth();
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = rawNext && rawNext.startsWith("/") ? rawNext : "/dashboard";
  if (session?.user) redirect(next);

  return (
    <main className="login-page">
      <h1>Giriş Yap</h1>
      <p className="login-subtitle">
        Self-hosted kimlik doğrulama sunucusu
      </p>
      <LoginForm next={next} />
    </main>
  );
}