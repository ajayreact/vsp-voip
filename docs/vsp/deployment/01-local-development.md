# Local Development

How to run VSP Phone on a developer machine. Production uses EC2; local dev mirrors the same services with localhost URLs.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18.18+ (20 recommended) | Required for API and Next.js |
| Docker + Compose | Current | PostgreSQL, Redis, optional full API stack |
| npm | Bundled with Node | Root and `web/` have separate lockfiles |

## Environment variables

Copy the template and fill in Telnyx credentials for telephony testing:

```bash
cp .env.example .env
```

Key variables for local dev:

| Variable | Local example | Purpose |
|----------|---------------|---------|
| `DATABASE_URL` | `postgresql://vsp:vsp@localhost:5432/vsp_voip` | Prisma / API |
| `REDIS_URL` | `redis://localhost:6379` | Sessions, cache, Call Control |
| `JWT_SECRET` | Any dev secret | Auth tokens |
| `API_PUBLIC_URL` | `http://localhost:3000` | Webhook URLs in logs |
| `WEB_ORIGIN` | `http://localhost:3001` | CORS |
| `ADMIN_ORIGIN` | `http://localhost:3001` | CORS |
| `TELNYX_API_KEY` | From Telnyx portal | Required for calls |
| `TELNYX_CALL_CONTROL_APP_ID` | From Telnyx | Inbound PSTN |
| `TELNYX_CREDENTIAL_CONNECTION_ID` | From Telnyx | WebRTC softphone |

Web build-time (optional file `web/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

See [.env.example](../../../.env.example) for the full list.

---

## Option A — Docker (database + Redis + API)

Start PostgreSQL, Redis, and the API container:

```bash
docker compose up -d
```

Compose overrides `DATABASE_URL` and `REDIS_URL` inside the API container to use service names `postgres` and `redis`. Migrations run automatically via [scripts/docker-entrypoint.sh](../../../scripts/docker-entrypoint.sh).

Verify:

```bash
curl -s http://localhost:3000/ready | jq .
docker compose logs api -f
```

---

## Option B — API on host (tsx)

Terminal 1 — data layer:

```bash
docker compose up -d postgres redis
```

Terminal 2 — API:

```bash
npm install
npx prisma migrate deploy
npm run dev:api
```

API listens on **port 3000** (`npm run dev:api` → `tsx server.js`).

---

## Frontend (Next.js)

Terminal 3 — web portal:

```bash
cd web
npm install
NEXT_PUBLIC_API_URL=http://localhost:3000 npm run dev
```

Portal runs on **port 3001** (`next dev -p 3001`).

Or from repo root:

```bash
npm run dev:web
```

Softphone V2 (when enabled): http://localhost:3001/softphone-v2  
WebRTC diagnostics: http://localhost:3001/softphone-v2/diagnostics

---

## Prisma (local)

| Task | Command |
|------|---------|
| Apply migrations | `npx prisma migrate deploy` |
| Generate client | `npx prisma generate` (also runs on `npm install` via postinstall) |
| Seed (once) | `npm run seed` |
| Studio | `npx prisma studio` |

Schema: [prisma/schema.prisma](../../../prisma/schema.prisma)  
Migrations: [prisma/migrations/](../../../prisma/migrations/)

---

## Redis (local)

Redis is required in production for Call Control sessions and caching. For local dev:

```bash
docker compose up -d redis
```

Test connectivity:

```bash
redis-cli -h localhost ping
# PONG
```

---

## Validation scripts (local)

Run against a running API:

```bash
npm run validate:p0
API_BASE=http://localhost:3000 npm run validate:phase2a
```

Telephony-focused:

```bash
npm run validate:call-transfer-session
npm run validate:blind-transfer
npm run validate:extension-did
```

---

## Common local issues

| Symptom | Check |
|---------|-------|
| API won't start | `DATABASE_URL`, Postgres running, migrations applied |
| CORS errors | `WEB_ORIGIN` / `ADMIN_ORIGIN` match browser URL |
| Softphone won't register | Telnyx credentials, `NEXT_PUBLIC_API_URL` |
| Webhooks not received | Use ngrok or tunnel; set `API_PUBLIC_URL` to public URL |

---

## Related docs

- [02-ec2-deployment.md](./02-ec2-deployment.md) — production deploy
- [03-docker.md](./03-docker.md) — Compose services
- [07-prisma.md](./07-prisma.md) — migrations in depth
- [14-telephony-validation.md](./14-telephony-validation.md) — call testing
