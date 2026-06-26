# Known Issues

Deployment and operations issues seen in production and staging. **Check these before assuming an application bug.**

---

## Frontend updated but API not rebuilt

**Symptoms:** New UI calls old API routes; 404 on new endpoints; feature flags missing server-side.

**Cause:** Only `deploy/deploy-web.sh` ran; Docker API image still on old commit.

**Fix:**

```bash
bash deploy/deploy-api.sh
curl -s https://api.vspphone.com/ready | jq .build.gitCommit
```

**Verify:** `build.gitCommit` matches `git rev-parse HEAD` on server.

---

## API updated but frontend stale

**Symptoms:** API returns new fields; UI doesn't show them; old softphone behavior.

**Cause:** `git pull` on API without `deploy-web.sh` / PM2 restart.

**Fix:**

```bash
bash deploy/deploy-web.sh
```

Hard refresh browser.

---

## Browser cache

**Symptoms:** Old JavaScript after successful deploy; diagnostics route 404; softphone behaves like previous version.

**Cause:** Cached `_next/static` chunks; service worker (if any).

**Fix:**

- Hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
- Incognito window
- DevTools → Network → Disable cache

**Verify:** View page source or network tab for new chunk hashes after deploy.

---

## Docker cache

**Symptoms:** New routes 404 after `git pull`; `/ready` shows old `gitCommit`; code change not reflected in logs.

**Cause:** Layer cache reused; container not recreated.

**Fix:**

```bash
export GIT_COMMIT="$(git rev-parse HEAD)"
docker compose build --no-cache api
docker compose up -d api
```

---

## Prisma migration missing

**Symptoms:** 500 errors; Prisma P2022 column not found; new feature crashes.

**Cause:** API deployed without migration; entrypoint failed silently.

**Fix:**

```bash
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma migrate status
docker compose restart api
```

Restore from backup if migration partially failed.

---

## PM2 restart forgotten

**Symptoms:** Build succeeded; `.next` updated on disk; users see old portal.

**Cause:** `npm run build` without `pm2 restart vsp-web`.

**Fix:**

```bash
pm2 restart vsp-web && pm2 save
```

---

## Incorrect environment variables

**Symptoms:** CORS errors; wrong webhook URLs in logs; API won't start; Redis errors.

**Common mistakes:**

| Variable | Mistake |
|----------|---------|
| `WEB_ORIGIN` | `http` vs `https`, trailing slash, wrong subdomain |
| `API_PUBLIC_URL` | Still `localhost` on EC2 |
| `DATABASE_URL` | Host `localhost` inside container instead of `postgres` |
| `REDIS_URL` | Missing or wrong host |

**Fix:** Edit `/opt/vsp-voip/.env`, restart API:

```bash
docker compose up -d api
```

PM2 env: edit [deploy/pm2.ecosystem.config.js](../../../deploy/pm2.ecosystem.config.js) or export before build.

---

## Missing Telnyx API key

**Symptoms:** `/ready` → `ready: false`; `telnyx.apiKeyConfigured: false`; calls fail.

**Fix:** Set `TELNYX_API_KEY` in `.env`; restart API. Verify in Telnyx Mission Control key is active.

---

## Incorrect JWT secret

**Symptoms:** All users logged out; 401 on every API call after deploy.

**Cause:** `JWT_SECRET` changed during deploy.

**Fix:** Restore previous `JWT_SECRET` from backup `.env`; restart API. Users re-login.

**Prevention:** Never rotate JWT during routine deploys.

---

## Nginx proxy mismatch

**Symptoms:** 502 Bad Gateway; 401 with valid token; WebSocket fails; webhooks timeout.

**Checks:**

```bash
curl -s http://127.0.0.1:3000/health
curl -s http://127.0.0.1:3001/ | head -5
sudo nginx -t
```

**Causes:**

- Upstream down (Docker / PM2)
- Missing `Authorization` header pass-through
- Wrong port in `proxy_pass`
- SSL cert expired

**Fix:** Restore [deploy/nginx/vspphone.conf](../../../deploy/nginx/vspphone.conf); reload Nginx; restart upstreams.

---

## One-way audio (deployment vs network)

If receive works but send doesn't after **no media code deploy**, suspect office firewall / WebRTC — not stale deploy.

Use: [scripts/office-webrtc-capture-checklist.md](../../../scripts/office-webrtc-capture-checklist.md)  
Route: `/softphone-v2/diagnostics`

If diagnostics page 404 → **frontend not deployed** (not a media regression).

---

## Outbound stuck on "Calling…"

**Cause:** Outbound Voice Profile not on Credential Connection (Telnyx config).

**Fix:** Telnyx portal → Credential Connection → Outbound tab → assign **VSP-Outbound** profile. Numbers stay on Call Control for inbound.

---

## Related docs

- [.cursor/rules/deployment-safety.mdc](../../../.cursor/rules/deployment-safety.mdc)
- [08-rollback.md](./08-rollback.md)
- [13-monitoring.md](./13-monitoring.md)
- [14-telephony-validation.md](./14-telephony-validation.md)
