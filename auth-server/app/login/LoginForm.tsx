"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="login-form">
      <input type="hidden" name="next" value={next} />

      <label className="login-label">
        E-posta
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="login-input"
        />
      </label>

      <label className="login-label">
        Şifre
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="login-input"
        />
      </label>

      {state?.error ? (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="login-button">
        {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
      </button>
    </form>
  );
}