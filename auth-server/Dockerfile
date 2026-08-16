# =============================================
# auth-server — Next.js 16 standalone Docker image
# =============================================
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# --- deps -----------------------------------------------------------
# argon2 is a native module: needs build tools to compile on Alpine (musl).
FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci

# --- builder --------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# --- runner ---------------------------------------------------------
# libstdc++ required at runtime by argon2's compiled .node binding.
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libstdc++
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Copy full node_modules so argon2 native binding (and its runtime deps) are present
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000

# 127.0.0.1 (IPv4 literal) avoids IPv6 ::1 resolution. No -4 flag: BusyBox wget lacks it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]