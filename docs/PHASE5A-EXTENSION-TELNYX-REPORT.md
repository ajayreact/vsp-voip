# Phase 5A — Extension Telnyx Desk Credentials

Implementation report for Phase A: real Telnyx credentials per Extension, SIP QR provisioning, desk registration tracking, and backfill tooling.

**Status:** Implemented  
**Scope:** Extension desk SIP only — mobile app, WebRTC login, inbound routing (Phase B), ring groups, and call queues unchanged.

---

## Migration report

### Migration file

`prisma/migrations/20260622160000_extension_telnyx_credentials/migration.sql`

### Columns added to `Extension`

| Column | Type | Purpose |
|--------|------|---------|
| `telnyxCredentialId` | `TEXT NULL` | Telnyx `/telephony_credentials` ID for desk phone |
| `telnyxSipUsername` | `TEXT NULL` | Telnyx SIP username (`gencred…`) used for desk registration and future inbound dial |
| `telnyxSipPassword` | `TEXT NULL` | Telnyx SIP password for desk QR / admin SIP panel |
| `sipRegistered` | `BOOLEAN NULL` | Desk phone registration state |
| `sipRegistrationCheckedAt` | `TIMESTAMP NULL` | Last registration check |
| `sipRegistrationSource` | `TEXT NULL` | `telnyx_webhook` / `telnyx_api` / `credentials_reset` |

### Index

- `Extension_telnyxSipUsername_idx` on `telnyxSipUsername` (webhook + poll lookup)

### Legacy columns (unchanged)

| Column | Status |
|--------|--------|
| `sipUsername` | Kept as **display label** (extension number, e.g. `101`) |
| `sipPassword` | **Deprecated** — no longer generated for new extensions |

### Deploy command

```powershell
cd e:\vsp-voip
npx prisma migrate deploy
```

### Backfill (post-deploy)

```powershell
npx tsx scripts/backfill-extension-telnyx-credentials.ts --all-tenants
# or
npx tsx scripts/backfill-extension-telnyx-credentials.ts --tenant-id <uuid>
```

Options: `--dry-run`, `--force` (recreate existing Telnyx credentials)

---

## API changes

### Unchanged endpoints (behavior preserved for mobile/WebRTC)

| Endpoint | Notes |
|----------|-------|
| `POST /api/softphone/token` | User credential — unchanged |
| `POST /api/softphone/push-token` | Mobile — unchanged |
| `POST /api/softphone/presence` | WebRTC heartbeat — unchanged |
| `POST /api/mobile/provision` | Mobile QR redeem — unchanged |
| `POST /api/tenant/extensions/:id/provisioning-token` (`target=mobile`) | Mobile QR — unchanged |

### Changed endpoints

#### `GET /api/tenant/extensions/:id/sip`

- **Before:** `sipUsername` / `sipPassword` were local DB values (`101` + random password).
- **After:** `sipUsername` / `sipPassword` are **Extension Telnyx desk credentials** when provisioned.
- `credentialId` = `Extension.telnyxCredentialId`
- `loginToken` still returned from **User** credential when employee assigned (WebRTC — unchanged).
- New response fields: `telnyxSipUsername`, `deskRegistered`

#### `POST /api/tenant/extensions/:id/provisioning-token` (`target=sip_phone`)

- QR payload version bumped to `v: 2`
- `sip.username` / `sip.password` = Telnyx extension credentials
- Added `telnyxCredentialId` in QR JSON

#### `POST /api/tenant/extensions/:id/reset-sip-credentials`

- **Before:** Reset local extension password **and cleared/recreated User mobile/WebRTC credential** (bug).
- **After:** Recreates **Extension Telnyx credential only**; User mobile/WebRTC credential **untouched**.

#### `POST /api/tenant/extensions` (create)

- No longer generates local `sipPassword` on insert
- Best-effort `ensureExtensionTelnyxCredential()` after create when Telnyx is configured

### Internal library changes

| Module | Change |
|--------|--------|
| `lib/extensionSip.js` | `ensureExtensionTelnyxCredential()`, updated `buildExtensionSipProfile()` |
| `lib/telnyxCallControl.js` | `createExtensionTelephonyCredential()`, `deleteTelephonyCredential()` |
| `lib/voiceTelemetry.js` | Desk registration via webhook + poll on `Extension.telnyxSipUsername` |
| `lib/extensions.js` | `deriveDeviceRows()` — desk ONLINE from `extension.sipRegistered` |
| `lib/pbxOwnership.js` | Chain validation checks extension Telnyx creds |

---

## Rollback plan

### Code rollback (safe anytime)

1. Revert API deployment to previous commit.
2. Inbound routing unchanged in Phase A — no call-path regression from rollback.

### Schema rollback (optional)

New columns are nullable — **no down migration required** for emergency rollback. Old code ignores new columns.

To remove columns later (after stable Phase B):

```sql
ALTER TABLE "Extension" DROP COLUMN IF EXISTS "telnyxCredentialId";
-- … etc.
```

### Telnyx rollback

- Extension desk credentials tagged `vsp-extension-desk` in Telnyx portal.
- Orphaned credentials after reset are harmless; delete manually if needed.
- User app credentials unaffected.

### Desk phone impact after rollback

- Desk phones provisioned with Phase A QR (Telnyx creds) will **not** register if code reverted to local `101`/random password model.
- **Mitigation:** Re-scan SIP QR after re-deploying Phase A.

---

## Validation

### Validation script

```powershell
npx tsx scripts/validate-phase-a-extension-telnyx.ts
```

Exit codes: `0` = all extensions have Telnyx creds; `2` = creds missing (run backfill); `1` = hard failure.

Optional live provision test:

```powershell
$env:PHASE_A_PROVISION_TEST='1'
npx tsx scripts/validate-phase-a-extension-telnyx.ts
```

### Manual checklist

| # | Step | Expected |
|---|------|----------|
| 1 | `npx prisma migrate deploy` | Migration applies cleanly |
| 2 | Backfill script | Each active extension gets `telnyxSipUsername` |
| 3 | Configure → SIP → view credentials | Shows `gencred…` username, not `101` |
| 4 | Generate SIP QR | QR `v:2` with Telnyx username/password |
| 5 | Register desk phone | `Extension.sipRegistered = true` |
| 6 | Reset extension SIP | New extension cred; mobile softphone still works |
| 7 | WebRTC softphone login | Unchanged — user credential |

---

## Ownership model (unchanged)

```
Company → Extension (desk Telnyx cred) → DID → Employee (app Telnyx cred) → Devices
```

Phase B will add inbound dual-target dialing using these credentials.
