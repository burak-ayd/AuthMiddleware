"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export type LoginState = { error?: string } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: next,
    });
    // Unreachable: signIn() throws a redirect on success.
    return null;
  } catch (e) {
    // Re-throw Next.js redirect signal so the navigation actually happens.
    // Next.js represents redirect as a thrown error with a NEXT_REDIRECT digest.
    if (e instanceof Error && /NEXT_REDIRECT/.test(e.message)) throw e;
    if (e && typeof e === "object" && "digest" in e) {
      const digest = String((e as { digest?: unknown }).digest);
      if (digest.startsWith("NEXT_REDIRECT")) throw e;
    }

    if (e instanceof AuthError) {
      return {
        error:
          e.type === "CredentialsSignin"
            ? "E-posta veya şifre hatalı."
            : "Giriş başarısız. Tekrar deneyin.",
      };
    }
    throw e;
  }
}