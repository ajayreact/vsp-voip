# Phase 2 — Implementation Phases

Checklist for Phases 2.1–2.7. **Start next phase only after prior phase is deployed and approved.**

---

## Phase 2.1 — Architecture freeze ✅

- [x] Architecture document ([01-architecture-freeze.md](./01-architecture-freeze.md))
- [x] Deprecated modules list ([02-deprecated-modules.md](./02-deprecated-modules.md))
- [x] No functional code changes
- [ ] Commit: `docs(phase2): freeze telephony architecture and deprecated modules`
- [ ] Deploy: docs only — no API/web restart required

---

## Phase 2.2 — Browser becomes admin portal

**Flag:** `NEXT_PUBLIC_BROWSER_CALLING_ENABLED=false` (default `false` in production builds)

### Tasks

- [ ] Add `isBrowserCallingEnabled()` in `web/src/lib/softphone-config.ts` (or new `web/src/lib/browser-calling-config.ts`)
- [ ] Gate softphone routes: redirect `/softphone`, `/softphone-v2` → dashboard or “Use mobile app” page
- [ ] Remove Telnyx SDK import/init from layout/shell when flag false
- [ ] Skip `/api/softphone/token` from web client when flag false
- [ ] Hide softphone nav items in tenant shell
- [ ] Document flag in `web/README.md` and `.env.example`
- [ ] `cd web && npm run build`
- [ ] `npm run test:telephony` (unchanged)

### Do not

- Delete softphone source trees
- Change mobile API contracts
- Change Call Control handlers

---

## Phase 2.3 — Mobile becomes primary client

**Scope:** `mobile-rn/` only unless explicitly approved.

### Tasks

- [ ] Verify PSTN outbound/inbound on production Call Control path
- [ ] Verify extension outbound/inbound (`newCall` + parked handler)
- [ ] Hold, mute, transfer parity with requirements
- [ ] Voicemail list/detail against API
- [ ] Presence heartbeat (`softphonePresence.ts`)
- [ ] Mark Flutter `mobile/` deprecated in README
- [ ] Mobile E2E or manual test checklist in `mobile-rn/docs/`

### Do not

- Enable browser calling
- Change extension dual-credential model yet (Phase 2.4)

---

## Phase 2.4 — Extension architecture

### Tasks

- [ ] Single SIP identity: employee `users.telnyxSipUsername` for app + desk
- [ ] Refactor `resolveExtensionRingTargets` — no simultaneous dual-URI ring to two credentials
- [ ] Enforce `phone_numbers.extensionId` for active tenant DIDs (migration + validation)
- [ ] Retire TeXML inbound (`/webhook` voice path) after DID audit
- [ ] Stop duplicate `call.*` handling on `/webhook/voice` (telemetry only)
- [ ] Remove or gate `POST /api/softphone/internal-call`
- [ ] Run `scripts/audit-telnyx-did-routing.js` for all tenant DIDs
- [ ] Update `docs/vsp/pbx/09-extension-routing.md`

---

## Phase 2.5 — QR provisioning

### Tasks

- [ ] QR payload: SIP user, password, domain, display name, extension
- [ ] `POST /api/mobile/provision` redeem flow aligned with employee credential
- [ ] Tenant admin UI: generate QR from extension/employee screen
- [ ] Mobile: scan → auto-configure (`mobile-rn/src/auth/qrLogin.ts`)
- [ ] No manual SIP entry in mobile happy path

---

## Phase 2.6 — Desk phone

### Tasks

- [ ] Desk uses same employee SIP identity (if Telnyx model supports concurrent registration; else document sequential device policy)
- [ ] Auto-provision profile (HTTP/QR for Grandstream)
- [ ] Validation: reject SIP User ID = extension number only
- [ ] Tenant admin: Create device → assign extension → download profile

---

## Phase 2.7 — Tenant portal redesign

**Only after 2.4 deployed stable.**

### Tasks

- [ ] Navigation: management pages only (see Phase 2 vision list)
- [ ] Remove duplicate config pages
- [ ] Softphone code still in repo but unreachable
- [ ] UX pass on Employees → Extensions → DIDs → Devices chain

---

## Commit and deploy pattern (each phase)

```bash
# Local
npm run test:telephony
cd web && npm run build   # when web touched

# Server (when API/web changed)
cd /opt/vsp-voip
git pull && bash deploy/deploy-api.sh   # API phases
git pull && bash deploy/deploy-web.sh   # web phases
```

Wait for explicit approval before starting the next phase number.
