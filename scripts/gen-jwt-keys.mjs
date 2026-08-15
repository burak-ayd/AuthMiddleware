#!/usr/bin/env node
// Generate RS256 keypair for JWT signing (PEM base64-encoded for env vars).
// Usage: node scripts/gen-jwt-keys.mjs

import crypto from "node:crypto";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const privB64 = Buffer.from(privateKey).toString("base64");
const pubB64 = Buffer.from(publicKey).toString("base64");

console.log("# Paste into .env as:");
console.log(`JWT_PRIVATE_KEY='${privB64}'`);
console.log(`JWT_PUBLIC_KEY='${pubB64}'`);
