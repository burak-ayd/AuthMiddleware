/**
 * NextAuth v5 catch-all route handler.
 * Exposes /api/auth/signin, /api/auth/callback/:provider, /api/auth/session, etc.
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;