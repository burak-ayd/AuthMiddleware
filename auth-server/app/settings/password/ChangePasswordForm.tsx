"use client";

import { useActionState } from "react";
import {
  changePasswordAction,
  type ChangePasswordState,
} from "./actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(
    changePasswordAction,
    null,
  );

  if (state?.success) {
    return <p style={{ color: "green" }}>Şifre güncellendi.</p>;
  }

  return (
    <form action={formAction} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <label>
        Mevcut şifre
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </label>
      <label>
        Yeni şifre (en az 12 karakter)
        <input
          name="newPassword"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
      </label>
      <label>
        Yeni şifre (tekrar)
        <input
          name="confirm"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
        />
      </label>

      {state?.error ? (
        <p style={{ color: "crimson" }} role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Şifreyi Güncelle"}
      </button>
    </form>
  );
}