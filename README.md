# MiddlewareAuth — Self-Hosted Auth Gateway + Phone Approval

OAuth2/OIDC auth server with Android phone-based approval (push notification
or 6-digit code). Sits in front of any Traefik-protected app.

**Architecture**
```
Browser → [Traefik: coolify] → forwardAuth → auth-server (Next.js 16)
                                              ↓
                                       pending approval
                                              ↓
                              Expo Push (push mode) | 6-digit code (numeric mode)
                                              ↓
                            Phone app (Expo SDK 57, Android) approves
```

## Status

- [x] **Phase 1** — Repo skeleton + docker-compose (auth-server, postgres, redis, demo-app) + healthcheck
- [ ] Phase 2 — Prisma schema + NextAuth Credentials + seed user
- [ ] Phase 3 — OAuth2/OIDC provider (authorize/token/jwks/userinfo)
- [ ] Phase 4 — Traefik `forwardAuth` middleware + demo-app OAuth callback
- [ ] Phase 5 — Approval backend (Expo Push + numeric)
- [ ] Phase 6 — Expo SDK 57 Android app
- [ ] Phase 7 — E2E test + demo-app
- [ ] Phase 8 — Hardening + Coolify publish

See `plan.md` for full plan.

## Development (Windows → deploy to Linux VPS)

**Lokal:** Windows'ta sadece editör. Build için Node 24 gerekli (`nvm4w`).

**VPS'te test:**
1. Repo'yu VPS'e push/clone et.
2. `coolify` network mevcut olmalı (Coolify kuruluysa otomatik). Değilse:
   ```bash
   docker network create coolify
   ```
3. `cp .env.example .env` ve secret'ları doldur:
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` — `node scripts/gen-jwt-keys.mjs`
4. Local DNS (VPS /etc/hosts veya Pi-hole):
   ```
   <VPS_IP>   auth.burakaydogan.tk
   <VPS_IP>   demo.burakaydogan.tk
   ```
5. `docker compose up -d --build`
6. `https://auth.burakaydogan.tk/api/health` → `{"ok":true}`

## Ports / Endpoints (Phase 1)

| Path | Purpose |
|---|---|
| `GET /api/health` | Liveness |
| `GET /api/ready`  | DB + Redis ping |
| `GET /`           | Landing page (placeholder) |

## File layout

```
auth-server/    # Next.js 16, Prisma, NextAuth, OAuth/OIDC
demo-app/       # Next.js 16, OAuth client demo (protected)
phone-app/      # Expo SDK 57 Android app (Phase 6)
docker-compose.yml
traefik-proxy.yml   # DO NOT EDIT — existing Traefik service
.env.example
plan.md
scripts/gen-jwt-keys.mjs
```
