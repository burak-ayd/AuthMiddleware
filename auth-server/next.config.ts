import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["argon2", "@prisma/client", "ioredis"],
  experimental: {
    // Allow large bodies for OAuth token exchanges (refresh tokens, etc.)
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
