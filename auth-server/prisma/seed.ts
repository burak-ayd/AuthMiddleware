/**
 * Prisma seed script.
 *
 * Idempotent: rerunning won't duplicate records.
 *
 * Usage:
 *   npm run db:seed
 *
 * Creates:
 *   - User kes.ici0619@gmail.com with a freshly-generated random password
 *     (printed to stdout — copy once and store in a password manager).
 *   - OAuthClient `demo-app` (confidential, redirect URIs: demo.burakaydogan.tk/callback).
 *     Re-uses DEMO_OAUTH_CLIENT_ID and DEMO_OAUTH_CLIENT_SECRET env vars when set.
 */
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { randomBytes, randomUUID } from "node:crypto";

const prisma = new PrismaClient();

const PRIMARY_EMAIL = "kes.ici0619@gmail.com";

function generatePassword(length = 24): string {
  // URL-safe base64 without padding, then strip ambiguous chars.
  return randomBytes(length)
    .toString("base64url")
    .replace(/[-_]/g, "")
    .slice(0, length);
}

async function main() {
  // ----- User -----
  let user = await prisma.user.findUnique({ where: { email: PRIMARY_EMAIL } });
  if (!user) {
    const password = generatePassword(20);
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456, // ~19 MiB
      timeCost: 2,
      parallelism: 1,
    });
    user = await prisma.user.create({
      data: {
        email: PRIMARY_EMAIL,
        passwordHash,
        displayName: "Burak",
        approvalMode: "push",
      },
    });
    console.log("\n========================================");
    console.log("  Seeded primary user");
    console.log("    email:    ", PRIMARY_EMAIL);
    console.log("    password: ", password);
    console.log("    (save this — it is NOT stored)");
    console.log("========================================\n");
  } else {
    console.log(`User ${PRIMARY_EMAIL} already exists — skipping.`);
  }

  // ----- Demo OAuth client -----
  const clientId = process.env.DEMO_OAUTH_CLIENT_ID ?? "demo-app";
  const clientSecret = process.env.DEMO_OAUTH_CLIENT_SECRET ?? randomUUID();

  let client = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (!client) {
    const clientSecretHash = await argon2.hash(clientSecret, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecretHash,
        name: "Demo App",
        redirectUris: ["https://demo.burakaydogan.tk/callback"],
        allowedScopes: "openid profile email",
        type: "confidential",
      },
    });
    console.log("========================================");
    console.log("  Seeded OAuth client");
    console.log("    clientId:     ", clientId);
    console.log("    clientSecret: ", clientSecret);
    console.log("    (save the secret — it is NOT stored)");
    console.log("========================================\n");
  } else {
    console.log(`OAuth client '${clientId}' already exists — skipping.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });