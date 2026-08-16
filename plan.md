# Plan: Self-Hosted Auth Gateway + Phone Approval (Android, Expo SDK 57)

> Amaç: Traefik (Coolify yönetiminde) önünde çalışan tüm uygulamaları koruyan,
> kendi yazdığımız OAuth2/OIDC tabanlı auth server. Kullanıcı, korumalı uygulamaya
> erişmek istediğinde auth server'a düşer; **telefondaki Android uygulaması** push
> bildirimle veya **login ekranındaki 6 haneli kodu** telefona girerek oturumu açar.
> Reverse proxy: Coolify üzerinden yayınlanan Traefik. Network: Coolify yönetir.

**Geliştirme aşaması:** Şimdilik **lokalde test** edilecek (bu repo kendi `docker-compose.yml`'ı).
**Coolify publish** Phase 8 sonunda, ayrı dokümante edilecek.

**Son kabul kriteri (Phase 8 sonu):** Auth server (`https://auth.burakaydogan.tk`, Next.js 16) +
Android telefon uygulaması (Expo SDK 57, managed workflow) çalışır durumda;
en az bir demo uygulama Traefik üzerinden korunmuş olarak erişilebilir.

**Mevcut Traefik yapısı** (`traefik-proxy.yml`):
- Network adı: **`coolify`** (external)
- Docker provider aktif (`exposedbydefault=false`)
- ACME resolver: `letsencrypt` (Cloudflare DNS challenge)
- Dashboard: `:8080`
- File provider: `/traefik/dynamic/`

---

## 0. Mimari Kararlar (Tech Stack)

| Bileşen | Seçim | Neden |
|---|---|---|
| Auth Server | **Next.js 16.3** (App Router) + TypeScript | Latest stable, Server Components, Server Actions |
| Auth kütüphanesi | **Auth.js v5 (NextAuth)** + Credentials Provider | Battle-tested, OAuth provider rolü oynatır |
| DB | **PostgreSQL 16** (Coolify managed) | Users, OAuth clients, devices, approvals |
| Session/Cache | **Redis 7** (Coolify managed) | Pending approvals, rate limit, numeric kod sayaçları |
| ORM | **Prisma 5** | Type-safe, kolay migration |
| Push | **expo-notifications** (Expo Push Service) | FCM karmaşıklığı yok, tek token; Expo Push Service HTTP API |
| Mobile | **Expo SDK 57** managed workflow | Talep edildi, development build gerekir (push için Expo Go yetmez) |
| Reverse proxy | **Traefik v3** (Coolify yönetiminde) | `forwardAuth` middleware |
| Publish | **Coolify** (self-hosted PaaS) | Traefik + network + TLS otomatik; GitHub webhook deploy |
| Container | **Docker** (Coolify build eder) | Nixpacks veya Dockerfile |
| Token | JWT (RS256) — `jose` | Stateless, Traefik `forwardAuth` ucuz |
| Approval modu | **Push (default) + Numeric (fallback)** | Her app için override edilebilir |
| Şifre hash | **Argon2id** | OWASP önerisi |
| Cookie | `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` prefix | CSRF + XSS koruması |

### Akış (high level)

```
[Browser] -> app.burakaydogan.tk (Coolify Traefik)
                  |
                  v
          forwardAuth -> auth.burakaydogan.tk/api/verify
                  |   (cookie yoksa 302 -> /login?app=...&next=...)
                  v
          [Auth Server: login ekranı, giriş sonrası approval]
                  |
                  v (user approvalMode: push veya numeric)
          �───────────────┴───────────────┐
          v                               v
   Expo Push HTTP API          6-haneli kod üret (login ekranında göster)
   (ExpoPushToken{...}data)               v
          v                       telefon app → POST /api/approval/verify-numeric
   phone app Approve/Deny                 v
          |                               v
          └─────────────┬─────────────────┘
                        v
                session açılır → redirect back to app (code+state)
```

### Klasör yapısı

```
MiddlewareAuth/
├── docker-compose.yml          # Lokal geliştirme (coolify network'e attach)
├── .env.example
├── .gitignore
├── plan.md
├── README.md
├── traefik-proxy.yml           # MEVCUT — değiştirmeyin
├── auth-server/                # Next.js 16
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── (auth)/approve/page.tsx
│   │   │   ├── api/auth/[...nextauth]/route.ts
│   │   │   ├── api/oauth/authorize/route.ts
│   │   │   ├── api/oauth/token/route.ts
│   │   │   ├── api/oauth/jwks/route.ts
│   │   │   ├── api/verify/route.ts          # Traefik forwardAuth
│   │   │   ├── api/approval/request/route.ts
│   │   │   ├── api/approval/poll/[id]/route.ts
│   │   │   ├── api/approval/respond/route.ts
│   │   │   ├── api/approval/verify-numeric/route.ts
│   │   │   ├── api/device/register/route.ts # phone app Expo push token
│   │   │   ├── api/health/route.ts
│   │   │   └── api/ready/route.ts
│   │   ├── lib/
│   │   │   ├── auth.ts          # NextAuth config
│   │   │   ├── oauth.ts         # OIDC provider
│   │   │   ├── jwt.ts           # RS256 sign/verify
│   │   │   ├── expo-push.ts     # Expo Push Service HTTP API
│   │   │   ├── approval.ts      # pending request logic
│   │   │   ├── ratelimit.ts
│   │   │   └── db.ts            # Prisma client singleton
│   │   └── components/...
│   └── tests/
│       └── approval.test.ts
├── phone-app/                  # Expo SDK 57 (managed, projectId: ee6e7de7-...)
│   ├── package.json
│   ├── app.json                # extra.eas.projectId
│   ├── eas.json
│   ├── app/                    # expo-router file-based
│   │   ├── _layout.tsx
│   │   ├── (auth)/login.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx       # Pending approvals list
│   │   │   └── settings.tsx    # approvalMode toggle
│   │   └── approval/[id].tsx   # Detay + Approve/Deny
│   ├── src/
│   │   ├── services/
│   │   │   ├── api.ts          # fetch wrapper
│   │   │   ├── notifications.ts # expo-notifications setup
│   │   │   └── secureStore.ts  # expo-secure-store
│   │   └── hooks/
│   └── assets/
└── demo-app/                   # Next.js 16 mini: korunan endpoint örneği
    └── ...
```

### Onay modu davranışı (kesin)

| Mod | Push gönder | Numeric kod üret | Login ekranı | Telefon işlemi |
|---|---|---|---|---|
| `push` (default) | ✅ | ❌ | "Telefonunuza onay bildirimi gönderildi" | Approve/Deny butonu |
| `numeric` | � | ✅ | 6 haneli kod gösterilir | Kod giriş ekranı |
| `both` (fallback) | ✅ | � (push başarısızsa) | push dene, timeout olursa kod göster | Approve/Deny veya kod |

**Override sırası:** env (`APPROVAL_MODE`) → user setting → OAuth client setting.
İlk aşamada sadece **env + user** override yeterli; client ayarı Phase 5 sonrası.

---

## 1. Phase 1 — Repo iskeleti + Lokal Docker ✅

**Hedef:** `docker compose up` ile auth server + postgres + redis + demo-app + traefik ayağa kalkar.
`https://auth.burakaydogan.tk` (local DNS) → 200.

### Adımlar
- [x] **1.1** Git init, branch `master`.
- [x] **1.2** `auth-server/` Next.js 16.3.1 scaffold (TypeScript, App Router, Turbopack default).
- [x] **1.3** `docker-compose.yml` — servisler: `postgres:16-alpine`, `redis:7-alpine`, `auth-server`, `demo-app`. Hepsi `coolify` external network.
- [x] **1.4** Traefik labels (auth-server): host router + `letsencrypt` resolver + `auth-gateway` middleware tanımı.
- [x] **1.5** `demo-app` host: `demo.burakaydogan.tk`, middleware `auth-gateway@docker`.
- [x] **1.6** `.env.example` + `.env` (gitignore'da) — tüm anahtarlar.
- [x] **1.7** `auth-server/Dockerfile` — multi-stage, `node:20-alpine`, non-root, healthcheck.
- [x] **1.8** `app/api/health/route.ts` + `app/api/ready/route.ts` (DB+Redis ping).
- [x] **1.9** `scripts/gen-jwt-keys.mjs` — RS256 keypair üretici.
- [x] **1.10** Prisma 6.19 (Prisma 7'de breaking `prisma.config.ts` zorunluluğu var — Prisma 6 LTS).
- [x] **1.11** Lokal build test: `next build` her iki app için başarılı.

### Kabul (lokal build tarafı)
- [x] `next build` her iki app için temiz.
- [ ] `docker compose up -d` VPS'te — henüz test edilmedi (lokalde docker yok, VPS'te).
- [ ] `https://auth.burakaydogan.tk/api/health` → `{"ok":true}`.

---

## 2. Phase 2 — Auth Server: veri modeli + kullanıcı

**Hedef:** Kullanıcı kayıt/giriş, OAuth client kaydı. ForwardAuth için `/api/verify` hazır.

### Adımlar
- [x] **2.1** `auth-server/prisma/schema.prisma`:
  - `User(id, email unique, passwordHash, displayName, approvalMode enum[push|numeric|both] default 'push', createdAt)`
  - `Device(id, userId, expoPushToken, platform enum[android|ios] default 'android', appVersion, lastSeen)`
  - `OAuthClient(id, clientId unique, clientSecretHash, name, redirectUris string[], allowedScopes, type enum[public|confidential], approvalModeOverride enum[push|numeric|both]? null)`
  - `OAuthCode(code PK, clientId, userId, redirectUri, scope, codeChallenge?, codeChallengeMethod?, expiresAt, consumedAt?)`
  - `PendingApproval(id PK, userId, deviceId?, clientId, requestedScope, appHost, status enum[pending|approved|denied|expired], numericCode? null, expiresAt, createdAt, respondedAt?)`
  - `Session(id, userId, expiresAt, userAgent, ip, revokedAt?)`
- [x] **2.2** Migration SQL üretildi (`prisma/migrations/0_init/migration.sql`); Dockerfile CMD'de `npx prisma migrate deploy` çalışıyor.
- [x] **2.3** Seed script: `prisma/seed.ts` — `kes.ici0619@gmail.com` (rastgele 20-char şifre stdout'a yazılır, **bir kez kaydet**), `approvalMode=push`. Demo OAuth client `demo-app` (confidential, redirect `https://demo.burakaydogan.tk/callback`). Idempotent.
- [x] **2.4** NextAuth v5 (`next-auth@5.0.0-beta.32`) Credentials provider: email+password, Argon2id doğrula, JWT session, `lib/auth.ts`.
- [x] **2.5** `app/login/page.tsx` (RSC) + `LoginForm.tsx` (client, `useActionState`) + `actions.ts` (server action, `signIn("credentials", ...)`).
- [x] **2.6** Login sonrası `?next=...` (güvenli: sadece `/` ile başlayan path'ler); yoksa `/dashboard`. Redirect to: server action'da `signIn` `redirectTo` parametresi.
- [x] **2.7** Şifre değiştirme ekranı (`/settings/password`) — Argon2id re-hash ile zorunlu.
- [x] **2.8** `/api/verify` (forwardAuth): session yoksa 302 `/login?next=<x-forwarded-uri>`; varsa 200 + `X-Forwarded-User` / `X-Forwarded-Email`.

### Kabul
- Container başlangıcında `migrate deploy` + seed (idempotent) çalışır.
- Seed user `kes.ici0619@gmail.com` ile `/login` üzerinden giriş yapılır, NextAuth JWT cookie oluşur.
- `/dashboard` ve `/settings/password` session gerektirir.
- Demo uygulamasının router'ına `auth-gateway@file` middleware eklendiğinde → 302 → `/login?next=...` → login → cookie → orijinal URL'e 200.

---

## 3. Phase 3 — OAuth2/OIDC Provider

**Hedef:** Auth server başka uygulamalara "Sign in with my-auth" sunar.

### Adımlar
- [ ] **3.1** `src/lib/jwt.ts` — RS256 anahtar çifti (env'den PEM), `sign(payload, ttl)`, `verify()`, JWK export.
- [ ] **3.2** `src/app/api/oauth/jwks/route.ts` — public JWKS (Traefik ve uygulamalar buradan public key alır).
- [ ] **3.3** `src/app/api/oauth/authorize/route.ts`:
  - validate `client_id`, `redirect_uri` (exact match), `scope`, `state`, `code_challenge`, `code_challenge_method=S256`.
  - Session yoksa → `/login?next=/api/oauth/authorize?...`.
  - Session var, scope `openid profile email` → `PendingApproval` INSERT → mod'a göre push veya numeric → `/approve?req=ID` sayfası.
- [ ] **3.4** `src/app/api/oauth/token/route.ts` — `grant_type=authorization_code`:
  - code'u consume et, `code_verifier` doğrula (PKCE).
  - access_token (JWT, 15min) + refresh_token (opak, 30 gün, DB'de hashed).
  - `grant_type=refresh_token` rotasyonu.
- [ ] **3.5** `src/app/api/oauth/userinfo/route.ts` — Bearer token ile user claim'leri.
- [ ] **3.6** `src/lib/oauth.ts` — `generateCode()`, `hashSecret()`, PKCE doğrulama (S256).
- [ ] **3.7** Approval başarılıysa → `/api/oauth/authorize`'a code ile redirect.

### Kabul
- `curl /api/oauth/jwks` geçerli JWK döner.
- Manuel akış: `/api/oauth/authorize?client_id=demo-app&...` → code al → `/api/oauth/token` ile access_token → `/api/oauth/userinfo` 200.

---

## 4. Phase 4 — Traefik `forwardAuth` + App Gateway (Coolify)

**Hedef:** Coolify yönetimindeki Traefik, korumalı uygulamaları auth server'a sorsun.

### Traefik `forwardAuth` middleware ekleme (lokal)

Mevcut Traefik yapısı (`traefik-proxy.yml`):
- Network: `coolify` external
- Docker provider aktif, `exposedbydefault=false`
- File provider `/traefik/dynamic/` (host'taki `/data/coolify/proxy/`)

**Lokal setup:** `auth-gateway` middleware'i `auth-server`'ın Traefik labels'ında tanımla:

```yaml
labels:
  - traefik.enable=true
  # auth-server router
  - traefik.http.routers.auth.rule=Host(`auth.burakaydogan.tk`)
  - traefik.http.routers.auth.entrypoints=https
  - traefik.http.routers.auth.tls=true
  - traefik.http.routers.auth.tls.certresolver=letsencrypt
  - traefik.http.services.auth.loadbalancer.server.port=3000
  # forwardAuth middleware (forwardAuth self-loop OK; localhost auth-server:3000)
  - traefik.http.middlewares.auth-gateway.forwardauth.address=http://auth-server:3000/api/verify
  - traefik.http.middlewares.auth-gateway.forwardauth.trustForwardHeader=true
  - traefik.http.middlewares.auth-gateway.forwardauth.authResponseHeaders=X-Forwarded-User,X-Forwarded-Email
```

**Not:** `auth-server`'ı kendine forwardAuth uygulama — sadece demo-app ve diğer korumalı router'lara uygulanacak.

### Adımlar
- [ ] **4.1** `auth-server/src/app/api/verify/route.ts` — Traefik forwardAuth:
  - Cookie'den session JWT oku.
  - `jose` ile verify → geçerli: `200` + `X-Forwarded-User`, `X-Forwarded-Email` header'ları.
  - Geçersiz/yoksa:
    - `Accept: text/html` → `302 Location: https://auth.burakaydogan.tk/login?app=<host>&next=<url>`.
    - Diğer → `401 + WWW-Authenticate`.
- [ ] **4.2** `demo-app/src/app/page.tsx` → `Hello {X-Forwarded-User}` (header forwardAuth'tan gelir).
- [ ] **4.3** `docker-compose.yml` `demo-app` labels:
  ```yaml
  - traefik.http.routers.demo.rule=Host(`demo.burakaydogan.tk`)
  - traefik.http.routers.demo.entrypoints=https
  - traefik.http.routers.demo.tls=true
  - traefik.http.routers.demo.tls.certresolver=letsencrypt
  - traefik.http.routers.demo.middlewares=auth-gateway@docker
  - traefik.http.services.demo.loadbalancer.server.port=3000
  ```
- [ ] **4.4** Traefik → auth-server internal DNS: `coolify` network'ünde container adı `auth-server` (coolify otomatik DNS sağlar).

### Kabul
- `https://demo.burakaydogan.tk` → login ekranına düşer → giriş sonrası demo-app'e döner, kullanıcı adı görünür.
- Doğrudan API çağrısı → 401.

---

## 5. Phase 5 — Phone Approval Backend (Expo Push + Numeric)

**Hedef:** Auth server, login onayını telefona iletebilir.

### Adımlar
- [ ] **5.1** `src/lib/approval.ts`:
  - `createPendingApproval(userId, clientId, scope, appHost, pkce?)` → INSERT, mod'a göre push veya numeric tetikle, ID dön.
  - `markApproved(id, byDeviceId?)`, `markDenied(id)`, `expireOld()`.
  - **TTL**: 5 dakika. **Numeric kod**: 6 hane (env). **Max deneme**: 5 (Redis sayaç).
- [ ] **5.2** `src/lib/expo-push.ts` — Expo Push Service HTTP API:
  - Endpoint: `https://exp.host/--/api/v2/push/send` (header: `Accept: application/json`, opsiyonel `Authorization: Bearer ${EXPO_ACCESS_TOKEN}`).
  - `sendApprovalPush(token, {title, body, data:{approvalId, appHost, scope, ip}})`.
- [ ] **5.3** `src/app/api/approval/poll/[id]/route.ts` — kullanıcı login ekranı her 2s poll eder. `status=approved` olunca callback URL'ine yönlendir (`/api/oauth/authorize` yeniden, code ile).
- [ ] **5.4** `src/app/api/approval/respond/route.ts` — phone app çağırır: `{approvalId, action: 'approve'|'deny', deviceToken}` → Bearer auth (phone app kendi session'ı ile), status günceller.
- [ ] **5.5** `src/app/api/approval/verify-numeric/route.ts` — `{approvalId, code}` → approved (rate-limited).
- [ ] **5.6** `src/app/api/device/register/route.ts` — phone app login sonrası `expoPushToken`'ı user'a bağlar.
- [ ] **5.7** `push` modunda numeric kod üretilmez, push gönderilir. `numeric` modunda push gönderilmez, login ekranında kod gösterilir. `both` modunda push dener, başarısız olursa (örn. token yok) numeric fallback.
- [ ] **5.8** Rate limit (Redis):
  - Numeric deneme: IP başına dakikada 10.
  - Approval request: user başına dakikada 5.
- [ ] **5.9** Override mantığı: `effectiveMode = oauthClient.approvalModeOverride ?? user.approvalMode ?? env.APPROVAL_MODE`.

### Kabul
- Login ekranı polling başlar, approve edilince otomatik yönlendirilir.
- Numeric mod seçilince login ekranında 6 haneli kod görünür.
- Push modunda Expo Push Service'e istek gider (server log'da response 200).

---

## 6. Phase 6 — Expo SDK 57 Android Uygulaması

**Hedef:** Android'de "Approve / Deny" bildirimi veya kodu girme ekranı.

**Expo projectId:** `ee6e7de7-c79c-4dd8-8c03-efe32b88195f` (kullanıcı verdi)
**EAS hesabı:** var → EAS Build (cloud) kullanılacak, kullanıcı lokal Android SDK kurmaz.

### Adımlar
- [ ] **6.1** Proje: `npx create-expo-app phone-app --template default` → SDK 57.
- [ ] **6.2** `app.json` plugin: `expo-notifications`, `expo-router`, channel (`default`, importance HIGH), `extra.eas.projectId = "ee6e7de7-c79c-4dd8-8c03-efe32b88195f"`.
- [ ] **6.3** `eas.json` profile: `preview` (Android internal distribution), `production`.
- [ ] **6.4** Build: `eas login` → `eas build --profile preview --platform android` (cloud) → APK indir → telefona yükle.
- [ ] **6.5** `src/services/notifications.ts`:
  - `setNotificationHandler` (foreground banner göster).
  - `registerForPushNotificationsAsync()` → `getExpoPushTokenAsync({projectId: 'ee6e7de7-c79c-4dd8-8c03-efe32b88195f'})` → token'ı `/api/device/register`'a POST.
  - `addNotificationReceivedListener` (foreground).
  - `addNotificationResponseReceivedListener` (tap → approval detay deep link).
- [ ] **6.6** `app/(tabs)/index.tsx` — Pending approvals listesi (`/api/approval/list`).
- [ ] **6.7** `app/approval/[id].tsx` — Detay: app adı, IP, scope, Approve/Deny → `/api/approval/respond`.
- [ ] **6.8** `app/(auth)/login.tsx` — email+password → NextAuth credentials login → JWT al → `expo-secure-store`'da sakla.
- [ ] **6.9** `app/(tabs)/settings.tsx` — `approvalMode` toggle (push / numeric / both), `PATCH /api/user/approval-mode`.
- [ ] **6.10** `app/(tabs)/_layout.tsx` — tabs, sadece login olmuş user erişir (root layout guard).
- [ ] **6.11** `app/_layout.tsx` — root layout:
  - Provider'lar (QueryClient, AuthProvider).
  - Auth guard: `useSegments()` ile `(auth)` grubunda değilse ve user yoksa `/login`'e redirect.
  - Notification observer hook (deep link için).
- [ ] **6.12** Lokalde test için: `eas build --profile development --platform android --local` (Android SDK + Java gerekli) VEYA `eas build --profile preview --platform android` (cloud).

### Kabul
- APK Android 13+'ta açılır.
- Login sonrası push token server'a gider (DB'de görünür).
- Push gelir → Approve denir → auth server `/authorize`'i tamamlar, callback'te code döner.
- Settings'ten `numeric` modu seçilince sonraki approval'da login ekranında kod gösterilir.

---

## 7. Phase 7 — Demo App + E2E

**Hedef:** Uçtan uca bir senaryo.

### Adımlar
- [ ] **7.1** `demo-app/` Next.js 16 mini: `GET /` → "Hello {email}" (X-Forwarded-User header).
- [ ] **7.2** Lokalde `docker compose up` → `demo.burakaydogan.tk` çalışır (Phase 4 labels).
- [ ] **7.3** Manuel test (README'ye yazılır):
  1. Telefonda phone-app → `kes.ici0619@gmail.com` + seed şifresi ile login.
  2. PC'de `https://demo.burakaydogan.tk` → auth login.
  3. Telefona Expo Push gelir → Approve.
  4. PC otomatik demo-app'e yönlendirilir, kullanıcı adı görünür.
  5. Settings'ten `numeric` moda geç → aynı akış → login ekranında 6 haneli kod → telefona gir → onay.

### Kabul
- Senaryo push modunda < 30 saniye tamamlanır.
- Numeric modunda kod ekranda görünür, telefon girer, onay geçer.

---

## 8. Phase 8 — E2E Doğrulama + Doküman + Coolify Publish

**Hedef:** Üretim benzeri yapılandırma, hardening, doküman, **Coolify publish hazırlığı**.

### Adımlar
- [ ] **8.1** Security hardening:
  - Argon2id params: `m=65536, t=3, p=4`.
  - Cookie flags zorunlu (NextAuth config).
  - CSRF: NextAuth built-in + OAuth `state`.
  - Push body'de **secret/PII yok**; sadece app adı + IP + scope.
  - Numeric kod 5 deneme sonra invalidate.
- [ ] **8.2** Logging: Pino structured, request ID, auth failures, approval denials.
- [ ] **8.3** Healthcheck'ler: `/api/health` (liveness), `/api/ready` (DB+Redis).
- [ ] **8.4** Backup: Coolify üzerinden Postgres volume snapshot, README'de retention.
- [ ] **8.5** `README.md` — kurulum, env değişkenleri, Coolify publish, EAS build, network yapısı, troubleshooting.
- [ ] **8.6** Smoke test script: `scripts/smoke.sh` — health → authorize → approve → token → userinfo.
- [ ] **8.7** **Coolify publish**: Bu repo'yu Coolify'a bağla. Compose dosyaları Coolify'ın anladığı formata uyarla (Nixpacks veya Dockerfile). Internal DNS referansları Coolify'ın DNS'ine çevrilecek. Traefik labels Coolify UI'dan eklenecek.

### Kabul
- Tüm checklist yeşil.
- README başkası tarafından sıfırdan takip edilebilir.
- Coolify'a publish için compose dosyası hazır.

---

## Riskler ve Mitigation

| Risk | Olasılık | Etki | Mitigation |
|---|---|---|---|
| Coolify'da Traefik label ekleme kısıtlı | Orta | Yüksek | Coolify custom labels destekler; yoksa Yol B (Traefik dynamic config) |
| Expo Push Service hız limiti (free tier) | Düşük | Orta | `EXPO_ACCESS_TOKEN` ile artırılabilir; rate limit loglanır |
| Phone app development build Coolify'da mı Expo Cloud'da mı | Düşük | Düşük | EAS Build (cloud) önerilir — kullanıcı Android SDK kurmaz |
| Android 13+ notification permission | Orta | Orta | Runtime prompt + docs |
| Pending approval spam | Orta | Orta | Redis rate limit: user 5/dk |
| Numeric code brute force | Düşük | Yüksek | 5 deneme + 5dk TTL + Redis counter |
| JWT private key leak | Düşük | Kritik | Coolify secret, .gitignore, üretim rehberi |
| Traefik ↔ auth-server internal DNS | Orta | Yüksek | Coolify container network otomatik; `http://auth-server:3000` |

---

## Açık Sorular (kullanıcıya)

_(Phase 1 başlangıcında çözüldü)_

1. ~~Expo projectId~~ → `ee6e7de7-c79c-4dd8-8c03-efe32b88195f` ✅
2. ~~EAS hesabı~~ → var ✅
3. ~~İlk user şifresi~~ → seed sırasında rastgele üret, console'a yaz ✅
4. ~~Coolify publish zamanı~~ → Phase 8 sonunda ✅

**Implementation sırasında ortaya çıkacaklar:**
- OAuth client redirect URI: local'de `https://demo.burakaydogan.tk/api/oauth/callback` (demo-app), Coolify publish'te gerçek URL.

---

## Definition of Done (tüm plan)

- [ ] Auth server `https://auth.burakaydogan.tk` Coolify'da healthy.
- [ ] Coolify Traefik `forwardAuth` 200/302 doğru dönüyor.
- [ ] Demo app (`demo.burakaydogan.tk`) korumalı host'tan erişilebilir.
- [ ] Android APK (`eas build --profile preview`) telefona yüklenebilir.
- [ ] Push modu + numeric mod + override çalışıyor.
- [ ] `README.md` sıfırdan kurulumu anlatıyor.
- [ ] `scripts/smoke.sh` başarıyla geçiyor.
