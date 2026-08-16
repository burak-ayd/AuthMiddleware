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

## VPS Deployment (Traefik + Coolify network)

Traefik zaten VPS'te çalışıyor (`traefik-proxy.yml`): network `coolify`, ACME `letsencrypt`
(Cloudflare DNS challenge), port 443 açık, port 80 kapalı. Bu repo yalnızca uygulamaları ayağa kaldırır.

### 1. Repo'yu VPS'e taşı

```bash
# Windows (bu klasörde) — commit attıktan sonra
git remote add origin https://github.com/<kullanıcı>/<repo>.git
git push -u origin master

# VPS
git clone https://github.com/<kullanıcı>/<repo>.git
cd <repo>
```

> `.env` gitignore'da — push edilmez, VPS'te oluşturulur.

### 2. Ön koşullar (bir kez)

```bash
docker --version && docker compose version          # Docker kurulu mu?
docker network ls | grep coolify                    # coolify network var mı?
```

- Docker yoksa: `curl -fsSL https://get.docker.com | sh`
- `coolify` network adı farklıysa: `docker inspect coolify-proxy --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'` ile gerçek adı bul, `docker-compose.yml`'deki `name: coolify`'ı güncelle.

### 3. `.env` oluştur

```bash
cp .env.example .env
```

| Değişken | Nasıl |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | `node scripts/gen-jwt-keys.mjs` |
| `EXPO_ACCESS_TOKEN` | şimdilik boş (Phase 5) |

Alternatif: lokalde üretilen `.env`'i SCP ile kopyala (aynı key'ler tutarlı kalır):
```bash
scp .env root@<VPS_IP>:/path/to/<repo>/
```

### 4. DNS kayıtları (Cloudflare)

```
auth.burakaydogan.tk  A  <VPS_IP>
demo.burakaydogan.tk  A  <VPS_IP>
```

### 5. Build & Start

```bash
docker compose up -d --build
docker compose ps   # auth-postgres, auth-redis healthy; auth-server, demo-app up
```

> Traefik docker provider yeni servisleri anında bulur — restart gerekmez.

### 6. Doğrula

```bash
curl https://auth.burakaydogan.tk/api/health   # → {"ok":true,"service":"auth-server"}
curl https://auth.burakaydogan.tk/api/ready    # → {"ok":true,"checks":{"db":"ok","redis":"ok"}}
curl -I https://demo.burakaydogan.tk           # → 302 (forwardAuth çalışıyor)
```

### 7. İlk kurulumda migration + seed

```bash
docker compose exec auth-server npx prisma migrate deploy
docker compose exec auth-server npm run db:seed
```

## Development (Windows → deploy to Linux VPS)

**Lokal:** Windows'ta sadece editör. Build için Node 24 gerekli (`nvm4w`).

**VPS'te test:** yukarıdaki "VPS Deployment" bölümünü izle.

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
