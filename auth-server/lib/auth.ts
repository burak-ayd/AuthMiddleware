/**
 * NextAuth v5 (beta) configuration.
 *
 * - Credentials provider: email + Argon2id password.
 * - JWT session strategy (stateless; Session table is for audit/revocation).
 * - Cookie name uses AUTH_URL host so it works behind Traefik with __Host- prefix.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "./db";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string } & DefaultSession["user"];
  }
}

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true, // behind Traefik reverse proxy
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 }, // 30 days
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return null;

        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = (user as { id: string }).id;
      return token;
    },
    session({ session, token }) {
      if (token.id && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.email = token.email ?? session.user.email;
      }
      return session;
    },
  },
});