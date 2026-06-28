# Production Deploy — Controlled Increments (Priority 1)

**Goal:** Ship accumulated Phase 2 + Phase 3 work without a single big-bang risk.  
**Branch:** `main` (11 commits ahead of last production deploy as of 2026-06-28)

---

## Commit map

| Increment | Stop at commit | Summary |
|-----------|----------------|---------|
| **D1** | `e09648c` | Phase 2 portal, QR provisioning, single SIP identity docs, browser admin |
| **D2** | `4ed4837` | + Webhook event deduplication (Phase 3.2.1) |
| **D3** | `bfed5d6` (HEAD) | + Inbound caller ID before answer, pending-caller lookup |

Full log (oldest → newest):

```
9a24203 docs(phase2): freeze telephony architecture
96d7d00 feat(phase2.5): secure employee QR provisioning
0af7d34 feat(phase2.7): enterprise tenant portal foundation
86d1c53 chore(phase2.8): remove deprecated Flutter mobile app
98d99df feat(phase2.7.2): phone numbers, devices, ring groups
73b3a4b feat(phase2.9.1): DID/devices, call history, reports
750c601 feat(phase2.7.3): portal pages (calls, recordings, voicemail…)
e09648c feat(phase2.9.2): enterprise ring groups admin
e5c4845 docs(phase3.1): production readiness audit
4ed4837 fix(phase3.2.1): Telnyx webhook event deduplication
bfed5d6 fix(softphone): resolve inbound caller identity before answer
```

---

## Pre-deploy (once per session)

On **workstation:**

```bash
git push origin main
```

On **EC2** (`/opt/vsp-voip`):

```bash
# Backup before any migration
docker compose exec postgres pg_dump -U vsp vsp > ~/backups/vsp-pre-deploy-$(date +%Y%m%d).sql

cp .env .env.backup.$(date +%Y%m%d)
git fetch origin main
```

Verify `.env` includes:

```env
NODE_ENV=production
API_PUBLIC_URL=https://api.vspphone.com
WEB_ORIGIN=https://app.vspphone.com
ADMIN_ORIGIN=https://admin.vspphone.com
REDIS_URL=redis://redis:6379
REDIS_REQUIRED=true
NEXT_PUBLIC_BROWSER_CALLING_ENABLED=false
```

Optional (D2+):

```env
TELNYX_WEBHOOK_DEDUP_TTL_SEC=86400
```

---

## Increment D1 — Portal + QR (commit `e09648c`)

**Telephony impact:** None (portal/API routes only; Call Control unchanged).

```bash
cd /opt/vsp-voip
git checkout e09648c
bash deploy/deploy-api.sh
bash deploy/deploy-web.sh
```

**Smoke (5 min):**

| # | Check | Pass |
|---|-------|------|
| 1 | `curl -sf https://api.vspphone.com/ready` | ☐ |
| 2 | Login at `https://app.vspphone.com` | ☐ |
| 3 | Dashboard, Phone Numbers, Devices, Ring Groups load | ☐ |
| 4 | Call History, Recordings, Voicemail pages load | ☐ |
| 5 | QR provision flow (employee mobile) | ☐ |
| 6 | Inbound + outbound test call still work (no regression) | ☐ |

**Rollback:** `git checkout <previous-prod-sha> && bash deploy/deploy-api.sh && bash deploy/deploy-web.sh`

---

## Increment D2 — Webhook deduplication (commit `4ed4837`)

**Telephony impact:** Ingress only — duplicate Telnyx webhooks dropped; routing/FSM unchanged.

```bash
cd /opt/vsp-voip
git checkout 4ed4837
bash deploy/deploy-api.sh
# Web unchanged from D1 unless portal commits between — optional: bash deploy/deploy-web.sh
```

**Requires:** `REDIS_URL` set (dedup uses Redis `SET NX`; in-memory fallback is per-process only).

**Smoke:**

| # | Check | Pass |
|---|-------|------|
| 1 | `/ready` shows Redis connected | ☐ |
| 2 | Inbound PSTN call completes | ☐ |
| 3 | Outbound mobile call completes | ☐ |
| 4 | API logs: no duplicate Call Control side effects on webhook retry | ☐ |

---

## Increment D3 — Inbound caller ID (commit `bfed5d6`)

**Telephony impact:** Softphone V2 client + read-only `GET /api/softphone/pending-inbound-caller`.

```bash
cd /opt/vsp-voip
git checkout bfed5d6   # or: git pull origin main && git checkout main
bash deploy/deploy-api.sh
bash deploy/deploy-web.sh
```

**Smoke (production acceptance for caller ID):**

| # | Check | Pass |
|---|-------|------|
| 1 | Normal mobile → DID: number on popup **before** Accept | ☐ |
| 2 | After Accept: same name/number | ☐ |
| 3 | CNAM caller (if available): name + number | ☐ |
| 4 | Withheld ID (*67): "Private Number" / "Anonymous" | ☐ |
| 5 | Two-way audio works | ☐ |
| 6 | Single incoming popup (no duplicate overlay) | ☐ |
| 7 | DevTools: `inbound.callerFields` on first ring, no errors | ☐ |

**Rollback:** Revert to `4ed4837` (keeps dedup; loses caller ID fix only).

---

## Post-deploy PAT (after D3)

Run full [Production Acceptance Test](./08-production-testing-plan.md) table before marking Phase 2 complete.

---

## Mobile APK

After API is stable at D3:

```powershell
.\scripts\build-mobile-android.ps1 -Release -ApiUrl "https://api.vspphone.com"
```

Deploy APK to landing page; employees on old APK continue until updated.

---

## What not to deploy together

- Do **not** skip D1 smoke before D2 (portal regressions).
- Do **not** deploy D2 without Redis in production.
- Do **not** change Telnyx webhook URLs during increment (same endpoints throughout).

---

## Related docs

- [06-deployment-checklist.md](./06-deployment-checklist.md)
- [09-inbound-caller-id-validation.md](./09-inbound-caller-id-validation.md)
- [deploy/PRODUCTION-CHECKLIST.md](../../deploy/PRODUCTION-CHECKLIST.md)
