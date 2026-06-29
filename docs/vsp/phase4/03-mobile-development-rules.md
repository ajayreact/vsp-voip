# VSP Phone — Phase 4 Mobile Development Rules (Mandatory)

**Status:** Mandatory for all Phase 4 work.  
**Backend baseline:** tag `phase2-production-ready`

---

## Project status

Phase 2 has been completed, production validated, tagged, and frozen.

Backend architecture is now considered the **production baseline**.

Phase 4 focuses **only on the React Native mobile application** (`mobile-rn/`).

---

## Backend freeze (STRICT)

Do **not** modify, refactor, redesign, replace, or optimize any backend component unless a real production bug is identified and explicitly approved.

### Protected areas

| Area | Examples |
|------|----------|
| Backend APIs | REST contracts, request/response shapes |
| Express routes | All route handlers under `routes/`, `lib/` |
| Call Control | `lib/inboundCallControl.js`, call session FSM |
| Telnyx Call Control | Webhooks, Telnyx REST clients |
| SIP architecture | Credential connections, employee telephony |
| QR provisioning backend | `POST /api/mobile/provision`, provisioning libs |
| Authentication APIs | JWT, refresh, login, logout |
| Database schema | `prisma/schema.prisma`, migrations |
| Prisma models | All models and relations |
| Extension routing | Internal dial, ring targets |
| Multi-tenant architecture | Tenant scoping, isolation |
| DID routing | Inbound PSTN routing |
| Ring groups | Entity model and handlers |
| Employee provisioning | Profile and credential issuance |
| Session architecture | Redis sessions, call state |
| Redis architecture | Session store, dedup keys |
| Existing provisioning flow | Admin QR → mobile redeem |

See also [02-backend-freeze-rules.md](./02-backend-freeze-rules.md).

### If a backend issue is discovered

**STOP.**

Report:

- Root cause
- Affected files
- Recommended fix

Do **not** implement backend workarounds inside the mobile application.

---

## Mobile development scope

All implementation must happen inside:

```
mobile-rn/
```

Unless explicitly approved — do not edit backend code.

---

## Existing backend is the source of truth

- Never create new APIs when an existing API already satisfies the requirement.
- Never duplicate business logic already implemented on the server.

### Reuse existing APIs

| Domain | Typical endpoints |
|--------|-------------------|
| Authentication | `/api/auth/*` |
| Provisioning | `/api/mobile/provision` |
| QR / employee | Provisioning redeem, employee profile |
| Extensions | Tenant extension routes |
| Phone numbers | `/api/numbers/*` |
| Call history | `/api/calls`, call log routes |
| Voicemail | Voicemail list/detail routes |
| Reporting | Dashboard and stats routes |
| Softphone / telephony | `/api/softphone/*` |

Reference: [PBX API reference](../pbx/20-api-reference.md)

---

## Telephony rules

The current telephony implementation is **production-approved**.

- Never invent a different call flow.
- Always reuse the existing architecture.

Before changing anything related to:

- SIP registration
- WebRTC
- Telnyx SDK
- Push notifications
- Call events
- Incoming / outgoing calls
- Audio routing, Bluetooth, speaker
- Hold, resume, transfer
- Reconnect, background registration
- Session recovery

**First** verify behavior against the official Telnyx documentation (`docs/telnyx/`).

Do not replace documented Telnyx behavior with assumptions.

### Inspect before modifying (mandatory)

Before changing **any** existing mobile telephony logic, read and understand the current code paths. Decide whether a change is actually necessary.

| Area | Start here |
|------|------------|
| SIP registration | `sip/service.ts`, `calling/TelnyxCallingProvider.tsx`, `calling/telnyxVoip.ts` |
| Call controller | `calling/callingController.ts`, `calling/callSessionTracker.ts` |
| Push notifications | `notifications/PushNotificationProvider.tsx`, `notifications/pushTokenService.ts` |
| Authentication | `store/authStore.ts`, `auth/authService.ts` (4.1 complete) |
| QR provisioning | `auth/provisionService.ts`, `auth/provisionQr.ts`, `screens/QrLoginScreen.tsx` |
| Call state management | `store/callingStore.ts`, `calling/CallOverlay.tsx`, `calling/telnyxCallMapping.ts` |

Full map: [04-development-sequence.md](./04-development-sequence.md#existing-implementation-map)

**Goal:** extend what already works — do not replace it.

### Extend — do not replace

| Module | Path |
|--------|------|
| Telnyx VoIP client | `mobile-rn/src/calling/telnyxVoip.ts` |
| Softphone service | `mobile-rn/src/calling/softphoneService.ts` |
| SIP service | `mobile-rn/src/sip/service.ts` |
| Push provider | `mobile-rn/src/notifications/PushNotificationProvider.tsx` |

---

## Do not rewrite (mandatory)

- Do **not** rewrite working modules for code style or architecture preferences.
- Prefer **incremental improvements** over large refactors.
- Preserve **API contracts** and **public interfaces** (exports, store shapes, service method signatures) unless a change is explicitly approved.
- If a module works in production, polish UI around it — don't churn the core.

This reduces unnecessary risk and keeps the production telephony baseline stable.

---

## Development sequence

Build in order. Complete each phase fully before starting the next.

| Phase | Scope |
|-------|-------|
| **4.1** | Authentication & provisioning — **complete** |
| **4.2** | Calling UI — Home, Dial Pad, Incoming, Outgoing, In-Call |
| **4.3** | Contacts & communication — Contacts, Favorites, Recents, Call History, Voicemail |
| **4.4** | Settings — SIP, Desk Phone QR, Audio, Notifications, Profile |
| **4.5** | Performance & polish — Animations, skeletons, FlashList, memory, transitions |

Details: [04-development-sequence.md](./04-development-sequence.md)

---

## UI / UX rules

Phase 4 is primarily a **UI/UX modernization** project.

### Goals

- Premium enterprise appearance
- Extremely responsive
- Minimal touch count
- Fast navigation
- Smooth scrolling
- Native-feeling animations
- Beautiful typography
- Large touch targets (48dp minimum)
- Soft shadows, rounded corners, modern spacing
- Excellent readability
- Professional light theme
- High accessibility

Design system: [mobile-rn/docs/DESIGN.md](../../../mobile-rn/docs/DESIGN.md)

### Avoid

- Heavy borders
- Cluttered layouts
- Unnecessary dialogs
- Nested menus
- Long loading states
- Abrupt transitions

**UI redesigns must preserve existing functionality.**

---

## Performance rules

Every screen should feel instant.

| Technique | Use when |
|-----------|----------|
| FlashList | Long lists (calls, contacts, messages, voicemail) |
| Memoization | `React.memo`, stable callbacks, selector patterns |
| Lazy loading | Stack screens, heavy tabs, deferred imports |
| React Query caching | API-backed lists and detail views |
| Image caching | Avatars, attachments |
| Virtualization | Any scrollable list over ~20 items |
| Native animations | Reanimated for transitions and gestures |
| Low memory usage | Avoid holding large payloads in component state |

Target **60 FPS** scrolling. Never introduce unnecessary re-renders.

---

## Design consistency

Maintain one consistent design language across every screen.

| Token | Location |
|-------|----------|
| Spacing scale | `mobile-rn/src/shared/theme/` |
| Typography | `typography.ts` |
| Icons | `@expo/vector-icons` — business metaphors |
| Cards / panels | `VspPanel`, `panel-card` parity |
| Buttons | `Button`, `VspIconButton` |
| Colors | `colors` — web portal parity |
| Animation timing | Shared duration/easing constants |
| Navigation | Tab + stack patterns in `src/navigation/` |

Every screen should feel like one premium application.

---

## Feature development

- Each feature must be **production-ready** before moving to the next.
- Never leave partially implemented functionality.
- **Complete one feature fully** before starting another.

Track status in [01-mobile-feature-matrix.md](./01-mobile-feature-matrix.md).

---

## Testing

When a feature is complete:

1. Run all mobile tests: `npm run test:mobile`
2. Ensure **no backend files** changed
3. Ensure **no API contracts** changed
4. Verify existing functionality still works (device smoke test)
5. Report using the format below

---

## Reporting format (mandatory)

For every completed feature provide:

### Summary

One paragraph: what shipped and why.

### Files modified

List every path under `mobile-rn/` (and `tests/mobile/` if applicable).

### Mobile tests

```bash
npm run test:mobile
```

Include pass/fail count.

### Screens completed

List screens or flows touched.

### Performance notes

FlashList, memoization, lazy loading, animation choices.

### Telephony impact

`None` | `UI only` | `Client telephony touch` — if touch, list modules and Telnyx docs consulted.

### Backend changes

**Must be NONE** unless explicitly approved.

### Remaining work

Known gaps, follow-ups, or deferred polish.

---

## Architecture principle

| Layer | Role |
|-------|------|
| **Backend** | Frozen production platform |
| **React Native app** | Premium enterprise client |

The mobile application must evolve **without** changing the production backend architecture.

Whenever telephony behavior is uncertain, consult the official Telnyx documentation before making changes.

**Maintain production stability above all else.**

---

## Related docs

- [Development sequence (4.2–4.5)](./04-development-sequence.md)
- [Phase 4 overview](./README.md)
- [Backend freeze rules](./02-backend-freeze-rules.md)
- [Feature matrix](./01-mobile-feature-matrix.md)
- [Phase 4.1 Authentication](../../../mobile-rn/docs/PHASE4-1-AUTH.md)
- [Telnyx KB](../../telnyx/index.md)
- [Protected telephony components](../../../.cursor/rules/protected-telephony-components.mdc)
- [Cursor rule: phase4-mobile-development](../../../.cursor/rules/phase4-mobile-development.mdc)
