/**
 * /api/logout — Demo-app access_token cookie'sini siler VE
 * auth-server session'ını da temizler (NextAuth signOut).
 *
 * NextAuth signOut callbackUrl ile demo-app login sayfasına dönülür.
 * Bu sayede hem demo-app access_token hem auth-server session temizlenir.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  jar.delete("demo_access_token");

  const authUrl = process.env.AUTH_SERVER_URL ?? "https://auth.burakaydogan.tk";
  const callbackUrl = `${process.env.DEMO_PUBLIC_URL ?? "https://demo.burakaydogan.tk"}/login`;
  redirect(`${authUrl}/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}