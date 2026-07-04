# RC1 Telephony Smoke Test

**Release:** v3.0.0-rc1  
**Environment:** Staging canary tenant only (runtime sync enabled)  
**Tester:** ________________  
**Date:** ________________  
**Tenant ID:** ________________  
**Runtime sync enabled:** ☐ Yes ☐ No (config-only — mark N/A)

**Legend:** PASS · FAIL · COMMENTS

> **RC1 note:** With `V3_RUNTIME_SYNC_ENABLED=false`, live telephony uses the **legacy Call Control path**. These tests validate end-user call behavior on the canary tenant after runtime sync is enabled. Config-only RC1 deployments should mark telephony items NOT TESTED.

---

## Test Setup

| # | Prerequisite | ✓ |
|---|--------------|---|
| 1 | Canary tenant configured in portal | ☐ |
| 2 | At least 2 extensions with softphones registered | ☐ |
| 3 | At least 1 desk phone provisioned (if testing desk) | ☐ |
| 4 | At least 1 DID assigned | ☐ |
| 5 | Ring group, queue, voicemail, call flow configured | ☐ |
| 6 | Mobile app logged in (if testing mobile) | ☐ |

---

## 1. Desk → Desk

| # | Test | Result | Comments |
|---|------|--------|----------|
| 1.1 | Extension A dials Extension B from desk phone | ☐ PASS ☐ FAIL | |
| 1.2 | Two-way audio confirmed | ☐ PASS ☐ FAIL | |
| 1.3 | Call disconnects cleanly | ☐ PASS ☐ FAIL | |
| 1.4 | CDR/history recorded (if applicable) | ☐ PASS ☐ FAIL | |

---

## 2. Mobile → Desk

| # | Test | Result | Comments |
|---|------|--------|----------|
| 2.1 | Mobile app dials desk extension | ☐ PASS ☐ FAIL | |
| 2.2 | Desk phone rings | ☐ PASS ☐ FAIL | |
| 2.3 | Answer — two-way audio | ☐ PASS ☐ FAIL | |
| 2.4 | Hangup from mobile | ☐ PASS ☐ FAIL | |

---

## 3. Desk → Mobile

| # | Test | Result | Comments |
|---|------|--------|----------|
| 3.1 | Desk dials mobile extension | ☐ PASS ☐ FAIL | |
| 3.2 | Mobile receives inbound | ☐ PASS ☐ FAIL | |
| 3.3 | Two-way audio | ☐ PASS ☐ FAIL | |
| 3.4 | Hangup from desk | ☐ PASS ☐ FAIL | |

---

## 4. DID → Extension

| # | Test | Result | Comments |
|---|------|--------|----------|
| 4.1 | Inbound PSTN call to assigned DID | ☐ PASS ☐ FAIL | |
| 4.2 | Routes to correct extension | ☐ PASS ☐ FAIL | |
| 4.3 | Two-way audio | ☐ PASS ☐ FAIL | |
| 4.4 | Caller ID displayed correctly | ☐ PASS ☐ FAIL | |

---

## 5. Ring Group

| # | Test | Result | Comments |
|---|------|--------|----------|
| 5.1 | Inbound call hits ring group | ☐ PASS ☐ FAIL | |
| 5.2 | All members ring per strategy | ☐ PASS ☐ FAIL | |
| 5.3 | First answer connects; others stop ringing | ☐ PASS ☐ FAIL | |
| 5.4 | No answer → fallback (VM/queue) works | ☐ PASS ☐ FAIL | |

---

## 6. Queue

| # | Test | Result | Comments |
|---|------|--------|----------|
| 6.1 | Call enters queue | ☐ PASS ☐ FAIL | |
| 6.2 | Agent assignment per strategy | ☐ PASS ☐ FAIL | |
| 6.3 | Caller hears hold/moh (if configured) | ☐ PASS ☐ FAIL | |
| 6.4 | Timeout/overflow behavior correct | ☐ PASS ☐ FAIL | |

---

## 7. Voicemail

| # | Test | Result | Comments |
|---|------|--------|----------|
| 7.1 | No-answer routes to voicemail | ☐ PASS ☐ FAIL | |
| 7.2 | Greeting plays | ☐ PASS ☐ FAIL | |
| 7.3 | Message recorded | ☐ PASS ☐ FAIL | |
| 7.4 | MWI / notification (if applicable) | ☐ PASS ☐ FAIL | |

---

## 8. Call Flow

| # | Test | Result | Comments |
|---|------|--------|----------|
| 8.1 | Inbound DID triggers configured call flow | ☐ PASS ☐ FAIL | |
| 8.2 | Flow branches execute correctly | ☐ PASS ☐ FAIL | |
| 8.3 | Simulator prediction matches live behavior | ☐ PASS ☐ FAIL | |
| 8.4 | Business hours / holiday override works | ☐ PASS ☐ FAIL | |

---

## 9. Inbound PSTN

| # | Test | Result | Comments |
|---|------|--------|----------|
| 9.1 | External caller reaches tenant via DID | ☐ PASS ☐ FAIL | |
| 9.2 | Routing matches portal config | ☐ PASS ☐ FAIL | |
| 9.3 | Audio quality acceptable | ☐ PASS ☐ FAIL | |
| 9.4 | No one-way audio | ☐ PASS ☐ FAIL | |

---

## 10. Outbound PSTN

| # | Test | Result | Comments |
|---|------|--------|----------|
| 10.1 | Extension dials external PSTN number | ☐ PASS ☐ FAIL | |
| 10.2 | Outbound caller ID correct | ☐ PASS ☐ FAIL | |
| 10.3 | Two-way audio | ☐ PASS ☐ FAIL | |
| 10.4 | Call completes and CDR logged | ☐ PASS ☐ FAIL | |

---

## Summary

| Metric | Count |
|--------|-------|
| Total scenarios | 40 |
| PASS | _____ |
| FAIL | _____ |

**Any FAIL → disable runtime sync immediately** (`03_RUNTIME_SYNC_CANARY.md` Step 7).

**Sign-off:** ☐ APPROVED ☐ REJECTED  
**Signed:** ________________ **Date:** ________________

---

## Related

- `03_RUNTIME_SYNC_CANARY.md`
- `docs/vsp/deployment/14-telephony-validation.md`
