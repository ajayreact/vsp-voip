# Phase 4.9 — Staging Deployment & Pilot Validation

Validation-only phase. **No new features. No UI redesign. No backend changes.**

This document is the pilot playbook for deploying EAS preview builds and validating on real devices before public release.

---

## Executive Summary

| Layer | Status | Notes |
|-------|--------|-------|
| Automated mobile tests | **PASS** | `npm run test:mobile` — 21 files, 66 tests |
| EAS preview configuration | **Ready** | Internal distribution, API + Firebase env baked in |
| Physical device validation | **Pilot team** | Matrices below must be executed and signed off |
| Backend changes | **NONE** | Backend remains production frozen |

**Staging definition for VSP Phone:** EAS `preview` profile → internal APK/IPA → `https://api.vspphone.com` with pilot tenant credentials. There is no separate staging API URL in the mobile client; pilot validation runs against production infrastructure with controlled tenant access.

---

## Pre-Flight Checklist (Before Pilot)

Complete before distributing builds to testers.

### Build & Deploy

- [ ] `google-services.json` present locally or as EAS secret (`GOOGLE_SERVICES_JSON`)
- [ ] Apple push certificates / provisioning profiles valid for internal distribution
- [ ] Telnyx portal: FCM + APNS credentials linked to mobile credential connection
- [ ] Pilot tenant provisioned with extensions, DIDs, messaging lines
- [ ] QR provisioning tokens generated for pilot users (not expired)

```powershell
cd mobile-rn
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile preview --platform ios
```

### Automated Gate (CI / local)

```powershell
cd e:\vsp-voip
npm run test:mobile
```

Expected: **66/66 tests pass, 0 failures.**

### Post-Install Smoke (5 min per device)

- [ ] App opens without crash
- [ ] Settings → Diagnostics shows **Production · https://api.vspphone.com**
- [ ] Login succeeds with pilot credentials
- [ ] SIP registration shows Connected
- [ ] Push registration shows Registered

---

## Device Matrix

Record each device used during pilot. Fill in **Result** and **Tester** columns.

| # | Platform | OS Version | Device Model | Network | Headset | Tester | Result |
|---|----------|------------|--------------|---------|---------|--------|--------|
| 1 | Android | | | Wi-Fi | — | | ☐ Pass ☐ Fail |
| 2 | Android | | | 4G/5G | Bluetooth | | ☐ Pass ☐ Fail |
| 3 | Android | | | Wi-Fi | Wired | | ☐ Pass ☐ Fail |
| 4 | iOS | | | Wi-Fi | — | | ☐ Pass ☐ Fail |
| 5 | iOS | | | 4G/5G | Bluetooth | | ☐ Pass ☐ Fail |
| 6 | iOS | | | Wi-Fi | AirPods / wired | | ☐ Pass ☐ Fail |

**Minimum pilot coverage:** 2 Android + 2 iOS, at least one cellular-only session each.

---

## Authentication Validation

| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Password login | Enter pilot email/password | Home screen, SIP connected | ☐ |
| Logout | You → Sign out | Returns to login; no cached messages/contacts from prior user | ☐ |
| Remember Me | Enable, kill app, reopen | Username prefilled; session restored if token valid | ☐ |
| Biometric login | Enable in Security, lock app | Biometric unlock succeeds | ☐ |
| QR login | Scan admin QR from Settings or login | Provisions extension, registers push | ☐ |
| Session restore | Kill app mid-session, reopen | No re-login if token valid | ☐ |
| Session expired | Revoke token server-side (admin) | Session expired screen, friendly message | ☐ |
| Offline login gate | Airplane mode at cold start (logged out) | Offline screen with Retry | ☐ |

---

## Telephony Validation

| Test | Steps | Expected | Pass |
|------|-------|----------|------|
| Mobile registration | Login fresh device | Diagnostics: push registered | ☐ |
| SIP registration | After login | Diagnostics: SIP Connected | ☐ |
| Outgoing PSTN | Dial external number | Ring, connect, two-way audio | ☐ |
| Incoming PSTN | Call pilot DID from external phone | Ring (foreground), answer, audio | ☐ |
| Extension-to-extension | Dial internal extension | Connects without PSTN | ☐ |
| Mobile-to-desk | Call desk phone from mobile | Desk rings, audio both ways | ☐ |
| Desk-to-mobile | Call mobile from desk | Mobile rings (incl. background) | ☐ |
| Hold / Resume | Active call → Hold → Resume | Remote hears hold music / silence; resume OK | ☐ |
| Mute / Unmute | Toggle mute | Remote cannot hear when muted | ☐ |
| Speaker | Toggle speaker | Audio routes to speaker | ☐ |
| Bluetooth | Connect BT headset during call | Audio on headset; UI route matches | ☐ |
| Wired headset | Plug wired headset | Audio switches; button if supported | ☐ |
| Lock-screen answer | Incoming while locked | Native answer UI (ConnectionService / CallKit) | ☐ |
| Background incoming | App backgrounded, incoming call | Native incoming UI + ring | ☐ |
| App killed incoming | Force-stop app, incoming call | FCM/APNS wake → native incoming UI | ☐ |

**Do not modify telephony code unless a defect is reproduced and root-caused.**

---

## Messaging Validation

| Test | Expected | Pass |
|------|----------|------|
| Send SMS | Message appears in thread; delivered | ☐ |
| Receive SMS | Thread updates; notification if background | ☐ |
| Offline send | Queued indicator; sends on reconnect | ☐ |
| Optimistic UI | Outgoing bubble appears before server ack | ☐ |
| Search | Finds contact, number, message body | ☐ |
| Conversation cache | Kill app, reopen — threads still visible offline | ☐ |
| Push notification | Background message → tap opens thread | ☐ |

---

## Contacts Validation

| Test | Expected | Pass |
|------|----------|------|
| Company directory | Loads extensions from tenant | ☐ |
| Customer contacts | CRUD if enabled for pilot user | ☐ |
| Favorites | Star/unstar persists | ☐ |
| Search | Filters by name, extension, number | ☐ |
| Call action | Tap call initiates outbound | ☐ |
| Message action | Opens new/existing thread | ☐ |
| Presence | Shows available/on-call where applicable | ☐ |

---

## Voicemail Validation

| Test | Expected | Pass |
|------|----------|------|
| List load | Voicemails appear with metadata | ☐ |
| Playback | Play/pause/seek works | ☐ |
| Download / share | Share sheet exports audio | ☐ |
| Notification | New VM → push + in-app notification | ☐ |
| Cache | Replay without re-download when cached | ☐ |
| Mark read | Read state persists after refresh | ☐ |

---

## Settings Validation

| Test | Expected | Pass |
|------|----------|------|
| Device management | Lists registered devices; refresh push works | ☐ |
| Diagnostics | Live SIP/push/network status; copy to clipboard | ☐ |
| QR provisioning | Re-provision from Settings | ☐ |
| Biometric settings | Enable/disable persists | ☐ |
| Theme / appearance | Font size preference applies on gate screens | ☐ |
| Notifications | Toggle message/VM/call alerts respected | ☐ |

---

## Performance Validation

Record measurements on at least one Android and one iOS device.

| Metric | Target | Device 1 | Device 2 |
|--------|--------|----------|----------|
| Cold start (tap → home) | < 3 s | | |
| App resume (background → foreground) | < 1 s | | |
| Scroll FPS (contacts / messages) | Smooth, no jank | | |
| Memory after 30 min use | Stable, no climb | | |
| Battery 8 hr idle (push registered) | < 5% abnormal drain | | |
| CPU during active call | No sustained overheat | | |
| Wi-Fi → cellular handoff mid-call | Reconnect or graceful drop | | |
| Airplane mode → restore | Offline UI → silent reconnect | | |

---

## Bug Log Template

Every issue **must** be classified before proposing a fix.

| ID | Summary | Severity | Classification | Root Cause | Repro Steps | Recommended Fix | Owner |
|----|---------|----------|----------------|------------|-------------|-----------------|-------|
| P9-001 | | Critical / High / Medium / Low | Deployment / Configuration / Tenant Data / Mobile Client / Backend / Telnyx SDK / Third-party | | | | |

### Classification Guide

| Class | When to use |
|-------|-------------|
| **Deployment** | Wrong build profile, missing google-services.json, wrong APNS env |
| **Configuration** | Telnyx portal, Firebase, EAS secrets, tenant DID not assigned |
| **Tenant Data** | Missing extension, wrong routing, expired QR token |
| **Mobile Client** | Reproducible app bug with stack trace / clear JS/native fault |
| **Backend** | API 5xx, wrong payload, auth bug — **STOP, report, do not workaround** |
| **Telnyx SDK** | CallKit/ConnectionService behavior inside SDK — verify Telnyx docs first |
| **Third-party** | Expo, React Native, Firebase module issue |

### Severity Guide

| Level | Definition |
|-------|------------|
| **Critical** | Cannot login, cannot receive calls, data leak, crash on launch |
| **High** | Major workflow broken (outbound fails, messages don't send) |
| **Medium** | Workaround exists; affects subset of users |
| **Low** | Cosmetic, edge case, minor UX |

---

## Known Configuration Notes (Pre-Validated)

These are **not bugs** — document for pilot testers.

| Topic | Detail |
|-------|--------|
| Preview APNS | `preview` profile uses `APNS_ENVIRONMENT=development` — required for ad-hoc/internal iOS builds |
| API URL | Preview and production builds both target `https://api.vspphone.com` |
| Voicemail delete | End-user delete not available (admin API only) — client hides locally |
| Change password | No self-service endpoint — screen shows guidance only |
| DND / forwarding | Read-only in app (requires TENANT_ADMIN backend) |

---

## Pilot Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Mobile lead | | | |
| QA lead | | | |
| IT / Telephony | | | |

### Recommendation (select one after pilot)

- [ ] **READY FOR PILOT** — builds deployed, validation in progress
- [ ] **READY FOR RELEASE CANDIDATE** — all critical/high bugs resolved
- [ ] **READY FOR PRODUCTION** — full matrix pass, sign-off complete
- [ ] **CHANGES REQUIRED** — open critical/high bugs (list IDs)

---

## Backend Changes

**NONE** (unless a verified backend defect is discovered during pilot — report per bug log, do not implement mobile workarounds).

---

## Automated Test Record

Last run during Phase 4.9:

```
npm run test:mobile
21 test files | 66 tests passed | 0 failed
```

Test areas covered: auth, provisioning, messaging cache, voicemail display, notifications, diagnostics, call display, session restore, production readiness (API trust, environment labels), app-state sync.

**Automated tests do not replace physical device telephony validation.**
