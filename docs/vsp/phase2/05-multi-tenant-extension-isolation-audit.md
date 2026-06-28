# Multi-Tenant Extension Isolation Audit

**Status:** Complete — prerequisite for Phase 2 implementation  
**Date:** 2026-06-24  
**Scope:** Full codebase audit for extension / ring-group / SIP / DID routing tenant isolation

---

## Requirement (frozen)

VSP Phone is a true multi-tenant PBX. Extension numbers are unique **only within a tenant**.

| Correct lookup | Incorrect lookup |
|----------------|------------------|
| `tenantId + extensionNumber` | `extensionNumber` alone |

The same rule applies to ring groups, voicemail boxes, and all future PBX entities (speed dials, feature codes, pickup groups, call queues, conference rooms).

**Routing chains must never skip tenant context:**

```
SIP:  Tenant → Extension → Employee → Devices
DID:  DID → Tenant → Extension → Employee → Devices
```

---

## Executive summary

| Area | Verdict |
|------|---------|
| **Database schema** | **Pass** — composite uniqueness on `Extension` and `RingGroup` |
| **Inbound PSTN (Call Control)** | **Pass** — tenant resolved from DID before extension lookup |
| **Internal extension dialing** | **Fail** — one production bug: global `ext:NNN` caller resolution |
| **REST APIs / portal UI** | **Pass** — queries scoped via `req.user.tenantId` |
| **SIP registration webhooks** | **Partial** — username lookup is global (mitigated by Telnyx-unique creds) |
| **Dev / ops scripts** | **Fail** — several scripts query extension number without tenant |
| **Future entities** | **N/A** — SpeedDial, FeatureCode, PickupGroup, CallQueue, ConferenceRoom not in schema yet |

**Blockers before Phase 2.2:** Fix the **P0** violation in `lib/internalExtensionDial.js`. All other items can be scheduled into Phase 2.4 (extension architecture) or a dedicated **2.0 isolation hardening** commit.

---

## Database schema

### Composite uniqueness (correct)

```270:271:prisma/schema.prisma
  @@unique([tenantId, extensionNumber])
  @@index([tenantId, status])
```

```558:559:prisma/schema.prisma
  @@unique([tenantId, name])
  @@unique([tenantId, extensionNumber])
```

| Model | Tenant-scoped uniqueness | Notes |
|-------|--------------------------|-------|
| `Extension` | `@@unique([tenantId, extensionNumber])` | OK |
| `RingGroup` | `@@unique([tenantId, extensionNumber])`, `@@unique([tenantId, name])` | OK |
| `Voicemail` | `tenantId` column + queries filter by tenant | OK |
| `PhoneNumber` | `number` globally unique (E.164) — correct for DIDs | DID → tenant is the entry point |
| Speed dials, feature codes, pickup groups, call queues, conference rooms | **Not in schema** | Add `@@unique([tenantId, …])` when implemented |

### Gaps to address in schema (Phase 2.4+)

- `User.telnyxSipUsername` and `Extension.telnyxSipUsername` are **indexed but not unique**. Telnyx-generated usernames are effectively global today, but the schema should enforce uniqueness at the platform level (or `@@unique([tenantId, telnyxSipUsername])` if usernames are ever tenant-scoped).

---

## Violations by severity

### P0 — Critical (cross-tenant routing risk)

#### 1. Global extension lookup on `ext:NNN` caller ID

**File:** `lib/internalExtensionDial.js` — `resolveCallerFromPayload()`  
**Lines:** 105–118

```105:118:lib/internalExtensionDial.js
  const extFromMatch = String(payload?.from || '').match(/^ext:(\d{2,6})$/i);
  if (extFromMatch) {
    const extension = await prisma.extension.findFirst({
      where: { extensionNumber: extFromMatch[1], status: 'ACTIVE' },
      include: { user: true },
    });
```

**Impact:** When internal Call Control events use `from: ext:101`, Prisma returns the **first** active extension 101 across **all tenants**. Subsequent routing uses that row's `tenantId`, so Tenant A can be misidentified as Tenant B.

**Used by:** `handleInternalExtensionCallInitiated()` → `loadTargetExtension(prisma, caller.tenantId, …)` — wrong tenant poisons the entire internal call chain.

**Fix:**

```javascript
// Option A (preferred): Remove ext:NNN fallback entirely — SIP username resolution already runs first.
// Option B: Require tenant-qualified caller label, e.g. ext:{tenantId}:101 or resolve tenant from
//           connection_id / custom_headers before extension number lookup.
// Option C: Never use ext:NNN; always use SIP username in from for Call Control internal calls.
```

**Phase:** Immediate hotfix (before 2.2) or first commit of 2.4.

---

### P1 — High (defense-in-depth / latent cross-tenant)

#### 2. SIP username resolution without tenant filter

**File:** `lib/internalExtensionDial.js` — `resolveCallerFromAddress()`  
**Lines:** 58–82

```58:82:lib/internalExtensionDial.js
  const deskExtension = await prisma.extension.findFirst({
    where: {
      telnyxSipUsername: { equals: sipUsername, mode: 'insensitive' },
      status: 'ACTIVE',
    },
    ...
  });
  ...
  const user = await prisma.user.findFirst({
    where: { telnyxSipUsername: { equals: sipUsername, mode: 'insensitive' } },
```

**Impact:** If two rows ever shared a username (data bug or future multi-tenant credential model), wrong tenant would win. Today Telnyx assigns globally unique SIP usernames, so risk is **latent**.

**Fix:** After lookup, verify tenant consistency when tenant is known from payload (`connection_id`, `client_state`, custom headers). Add DB unique constraint on `telnyxSipUsername` (platform-wide) in Phase 2.4.

#### 3. Inbound internal-extension branch before DID tenant resolution

**File:** `lib/inboundCallControl.js` — `handleCallInitiated()`  
**Lines:** 1251–1260

```1251:1260:lib/inboundCallControl.js
  const internalExtension = parseInternalExtensionDestination(payload.to);
  if (internalExtension) {
    const handled = await handleInternalExtensionCallInitiated(
      prisma,
      payload,
      platform,
      internalExtension,
    );
```

**Impact:** Runs **before** `resolveInboundContext()`. Safe for real PSTN (E.164 `to` has ≥10 digits and is skipped). Risky if a webhook ever arrives with a bare extension as `to` without tenant context.

**Fix:** Gate this branch on outbound/credential-connection direction only, or require resolved caller tenant before parsing bare extension destinations on inbound events.

#### 4. Telnyx registration webhook — global username update

**File:** `lib/voiceTelemetry.js` — registration handler  
**Lines:** 116–137

Updates `user` / `extension` by `telnyxSipUsername` only, no tenant filter.

**Impact:** Low today (unique Telnyx creds). Becomes P0 if username reuse is ever allowed.

**Fix:** Add `@@unique` on username columns; optionally include `connection_id` → tenant mapping in webhook handler.

---

### P2 — Medium (UUID lookups without tenant — safe by ID uniqueness, should still verify)

These use **extension UUID** (`id`) without `tenantId`. UUIDs are globally unique, so cross-tenant collision is impossible, but defense-in-depth requires `tenantId` when available in session/context.

| File | Lines | Context | Recommendation |
|------|-------|---------|----------------|
| `lib/inboundRouting.js` | 256–259 | `resolveDirectUserRingTargets` — extension by `phoneRecord.extensionId` | Add `tenantId: resolvedTenantId` to `where` |
| `lib/inboundRouting.js` | 438–441 | `resolveRingTargets` — `multiDeviceEnabled` check | Add `tenantId` from caller context |
| `lib/adminDidManagement.js` | 33–36 | `clearPhoneTenantLinks` — extension by `primaryPhoneNumberId` | Add `tenantId: phone.tenantId` when known |
| `lib/pbxOwnership.js` | 44 | `findUnique({ id })` after tenant-scoped list | Acceptable (same tenant loop) |

---

### P3 — Low (dev / ops scripts)

Scripts that query `extensionNumber` without `tenantId` — not production runtime, but violate the rule and can mislead operators on multi-tenant servers.

| Script | Line | Issue |
|--------|------|-------|
| `scripts/review-extension-102.ts` | 12 | `where: { extensionNumber: '102' }` |
| `scripts/verify-extension-desk-registration.ts` | 51 | CLI arg extension number only |

**Fix:** Require `--tenant-id` or derive tenant from env / slug in all ops scripts.

---

## Verified correct patterns

These modules **already enforce** `tenantId + extensionNumber` (or DID → tenant first):

| Module | Pattern |
|--------|---------|
| `lib/internalExtensionDial.js` | `loadTargetExtension(prisma, tenantId, extensionNumber)` |
| `lib/internalExtensionDial.js` | `loadTargetExtensionByDid(prisma, tenantId, destination)` |
| `lib/internalExtensionDial.js` | `initiateInternalCallFromApi(prisma, tenantId, userId, …)` |
| `lib/ringGroupRouter.js` | `loadRingGroupByExtensionNumber(prisma, tenantId, extensionNumber)` |
| `lib/callTransferControl.js` | `where: { tenantId, extensionNumber, status: 'ACTIVE' }` |
| `lib/voicemail.js` | `resolveExtensionIdForVoicemail(prisma, tenantId, …)` |
| `lib/extensionFeatures.js` | Forward/intercom targets: `tenantId` + `extensionNumber` |
| `lib/inboundRouting.js` | `resolveExtensionForPhoneRecord(prisma, tenantId, phoneRecord)` |
| `lib/inboundCallControl.js` | `resolveInboundContext` — DID → `phoneNumber.tenantId` first |
| `routes/extensions.js` | All CRUD via `req.user.tenantId` |
| `routes/portal.js` | Internal call API: `initiateInternalCallFromApi(..., req.user.tenantId, …)` |
| `routes/ringGroups.js` | All operations scoped to `req.user.tenantId` |

---

## Call-path verification

### Inbound PSTN (correct)

```
payload.to (E.164 DID)
  → resolveInboundContext()
    → phoneNumber.findUnique({ number: to })  // DID is globally unique
    → tenant = phoneRecord.tenant
  → resolveRingTargets(prisma, tenantId, …)
    → resolveExtensionForPhoneRecord(prisma, tenantId, phoneRecord)
```

Tenant is always established from the DID **before** any extension-number routing.

### Internal extension dial (mostly correct, one P0 bug)

```
WebRTC / Call Control outbound
  → resolveCallerFromPayload()
    → [BUG] ext:NNN global lookup          ← P0
    → SIP username lookup (correct, de facto unique)
  → handleInternalExtensionCallInitiated()
    → loadTargetExtension(prisma, caller.tenantId, targetExtensionNumber)  ✓
    → loadRingGroupByExtensionNumber(prisma, tenant.id, …)                 ✓
```

### SIP registration (acceptable today)

```
Telnyx registration webhook
  → telnyxSipUsername match on User, then Extension
  → tenant implied by unique Telnyx credential
```

Phase 2.4 single-credential model simplifies this to one lookup path per employee.

### REST / UI (correct)

- Extension lists, security, voicemail, provisioning: `where: { tenantId: req.user.tenantId }`
- Mobile `POST /api/softphone/internal-call`: body has `extensionNumber` only; server adds tenant from JWT

---

## Security checklist

| Threat | Enforced today? | Gap |
|--------|-----------------|-----|
| Tenant A sees Tenant B extensions in API | Yes | JWT `tenantId` on all tenant routes |
| Tenant A calls Tenant B extension via server API | Yes | `initiateInternalCallFromApi` uses JWT tenant |
| Tenant A calls Tenant B via Call Control `ext:NNN` | **No** | P0 bug in `resolveCallerFromPayload` |
| Tenant A accesses Tenant B SIP credentials | Yes | Provisioning routes require `tenantId + extensionId` |
| Tenant A accesses Tenant B voicemail | Yes | `listExtensionVoicemails(prisma, tenantId, extensionId)` |
| Tenant A accesses Tenant B recordings | Yes | Call logs / recordings filtered by `tenantId` |
| Cross-tenant DID routing | Yes | DID globally unique; unassigned DIDs rejected |

---

## Remediation plan

### Phase 2.0 — Isolation hotfix (recommended before 2.2)

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1 | Remove or tenant-scope `ext:NNN` caller resolution | `lib/internalExtensionDial.js` | Small |
| 2 | Add regression test: two tenants, same ext 101, internal call stays in caller tenant | `tests/lib/` | Small |
| 3 | Gate `handleCallInitiated` internal-extension branch to outbound/credential calls only | `lib/inboundCallControl.js` | Small |

### Phase 2.4 — Extension architecture

| # | Task |
|---|------|
| 4 | Add `@@unique` on `telnyxSipUsername` (User + Extension) or document platform-global uniqueness contract |
| 5 | Add `tenantId` to all P2 defense-in-depth queries |
| 6 | Introduce shared helper: `findExtensionByNumber(prisma, tenantId, extensionNumber)` — ban raw `extensionNumber`-only queries via ESLint |
| 7 | When adding SpeedDial, FeatureCode, PickupGroup, CallQueue, ConferenceRoom — mandatory `@@unique([tenantId, …])` |
| 8 | Consolidate to single employee SIP credential; remove desk-only extension username path |

### Ongoing

| # | Task |
|---|------|
| 9 | Update dev scripts to require `--tenant-id` |
| 10 | Add `tests/lib/tenant-extension-isolation.test.ts` to CI (`npm run test:telephony`) |
| 11 | Document tenant isolation rule in `docs/vsp/pbx/` and Cursor rule |

---

## ESLint / test guard (proposed)

```javascript
// lib/extensionLookup.js — single approved helper
async function findActiveExtensionByNumber(prisma, tenantId, extensionNumber) {
  if (!tenantId) throw new Error('tenantId is required for extension lookup');
  return prisma.extension.findFirst({
    where: { tenantId, extensionNumber: String(extensionNumber).trim(), status: 'ACTIVE' },
  });
}
```

**Test case (required):**

1. Create Tenant A and Tenant B, each with extension `101` assigned to different users.
2. Simulate Call Control payload with `from: ext:101` and SIP username of Tenant A user.
3. Assert target resolution uses Tenant A, never Tenant B.
4. Assert API internal call from Tenant A user to `102` rings Tenant A's 102 only.

---

## Approval gate

| Gate | Requirement |
|------|-------------|
| Phase 2.2 (browser admin flag) | P0 fix **recommended**; audit doc approved |
| Phase 2.4 (extension architecture) | P0 + P1 + helper + tests **required** |
| New PBX entities | Composite uniqueness + tenant-scoped queries **required** |

---

## Related documents

- [01-architecture-freeze.md](./01-architecture-freeze.md)
- [04-architecture-review-and-plan.md](./04-architecture-review-and-plan.md)
- [PBX call flow](../pbx/02-call-flow.md)
