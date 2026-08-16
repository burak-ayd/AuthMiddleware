#!/usr/bin/env node
// Generate RS256 keypair for JWT signing (PEM-encoded for env vars).
//
// Usage:
//   node scripts/gen-jwt-keys.mjs
//
// Pastes single-line PEM strings into .env. Newlines in PEM are escaped
// as literal "\n" (two characters), which lib/jwt.ts decodes back to
// real newlines at runtime.

import crypto from "node:crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Collapse PEM to single line with escaped newlines so it fits in .env.
const oneline = (pem) => pem.replace(/\r?\n/g, "\\n");

console.log("# Paste into .env as:");
console.log(`JWT_PRIVATE_KEY='${oneline(privateKey)}'`);
console.log(`JWT_PUBLIC_KEY='${oneline(publicKey)}'`);
