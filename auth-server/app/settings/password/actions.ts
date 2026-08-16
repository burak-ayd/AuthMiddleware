"use server";

import { redirect } from "next/navigation";
import argon2 from "argon2";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const changeSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12, "Yeni şifre en az 12 karakter olmalı"),
    confirm: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Yeni şifre ve onayı eşleşmiyor",
    path: ["confirm"],
  });

export type ChangePasswordState = { error?: string; success?: boolean } | null;

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings/password");

  const parsed = changeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz girdi" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) return { error: "Kullanıcı bulunamadı" };

  const ok = await argon2.verify(user.passwordHash, parsed.data.currentPassword);
  if (!ok) return { error: "Mevcut şifre hatalı" };

  const newHash = await argon2.hash(parsed.data.newPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return { success: true };
}