# Telnyx Compliance Review — Phase 3.1

**Purpose:** Compare VSP PBX telephony implementation against [Telnyx developer documentation](https://developers.telnyx.com/docs).  
**Mode:** List deviations only — **do not change** until explicitly approved.

---

## Review areas

| Telnyx product | VSP usage |
|----------------|-----------|
| Call Control API | Inbound PSTN, bridge, transfer, voicemail, recording |
| TeXML / Voice API | Legacy greeting path, some status webhooks |
| Credential Connections | WebRTC (mobile), SIP desk phones |
| Outbound Voice Profile | PSTN outbound, recording |
| Webhooks | Signature verification, async processing |
| Messaging | SMS (optional) |

---

## Compliant / aligned

| Topic | VSP implementation | Telnyx guidance |
|-------|---------------------|-----------------|
| Webhook signature | `lib/telnyxVerify.js` — Ed25519 public key | Verify all webhooks |
| Async webhook response | 200 ack then process | Respond quickly; process async |
| Call Control commands | answer, dial, bridge, hangup, speak, record | Standard API |
| `command_id` on transfer/bridge | Present in transfer paths | Idempotent command retry |
| SIP credential per user/extension | Telnyx Credential Connection | Recommended for multi-device |
| Recording webhooks | `call.recording.saved` handling | Documented event |
| Public webhook URL | `API_PUBLIC_URL` required in prod | Must be reachable |

---

## Deviations (pending approval)

### TX-001 — Dual webhook endpoints for Call Control events

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Deviation** | Same `call.*` events may be handled by both `/webhook/call-control` and `/webhook/voice`. |
| **Telnyx expectation** | One webhook URL per application/event subscription. |
| **Recommendation** | Configure single URL in Mission Control; deprecate duplicate handler. |
| **Proposed fix** | Ops config + code path removal after verification. |

---

### TX-002 — No webhook event `id` deduplication

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Deviation** | Events processed on every delivery; no store keyed on event UUID. |
| **Telnyx expectation** | Handle duplicate deliveries idempotently (retries, at-least-once). |
| **Recommendation** | Implement dedup store (Redis TTL 24h). |
| **Proposed fix** | Phase 3.2 middleware. |

---

### TX-003 — `command_id` not on all dial commands

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Deviation** | `dialDestination()` omits `command_id`. |
| **Telnyx expectation** | Optional but recommended for idempotent command replay. |
| **Recommendation** | Add stable `command_id` per outbound leg. |
| **Proposed fix** | `telnyxCallControl.js` update. |

---

### TX-004 — TeXML + Call Control hybrid routing

| Field | Detail |
|-------|--------|
| **Severity** | Medium (architectural) |
| **Deviation** | Some inbound paths use TeXML (`buildInboundCallTexml`); primary path uses Call Control FSM. |
| **Telnyx expectation** | Valid — both supported; complexity is operational. |
| **Recommendation** | Document which DIDs/apps use which mode; avoid double-handling. |
| **Proposed fix** | Architecture doc update only. |

---

### TX-005 — WebRTC SDK in mobile only (not browser portal)

| Field | Detail |
|-------|--------|
| **Severity** | N/A (intentional) |
| **Deviation** | Browser portal explicitly disables Telnyx SDK (`NEXT_PUBLIC_BROWSER_CALLING_ENABLED=false`). |
| **Telnyx expectation** | WebRTC via `@telnyx/webrtc` — used in `mobile-rn` only. |
| **Recommendation** | Compliant with product decision; mobile uses official SDK. |
| **Proposed fix** | None. |

---

### TX-006 — Recording sync via API poll + webhook

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Deviation** | Portal offers manual `syncCallRecordingsFromTelnyx` in addition to webhooks. |
| **Telnyx expectation** | Webhooks preferred; API list is valid fallback. |
| **Recommendation** | Rely on webhooks in prod; sync as admin recovery tool. |
| **Proposed fix** | Default `sync=0` (see PERF-004). |

---

### TX-007 — Custom JWT after provisioning (not Telnyx OAuth)

| Field | Detail |
|-------|--------|
| **Severity** | N/A (application layer) |
| **Deviation** | VSP issues own JWT after QR redeem; Telnyx credentials are separate. |
| **Telnyx expectation** | SIP auth via Credential Connection — compliant. |
| **Recommendation** | Clear separation: Telnyx = media; VSP JWT = app API. |
| **Proposed fix** | None for Telnyx compliance. |

---

## Verification checklist (Mission Control)

| Setting | Verify |
|---------|--------|
| Call Control Application webhook URL | Single canonical URL |
| Connection webhook URL | Matches `API_PUBLIC_URL` |
| Outbound Voice Profile attached | Mobile + PSTN outbound |
| Recording enabled on profile | Matches tenant setting |
| Public key for webhook verification | Matches `TELNYX_PUBLIC_KEY` |
| SIP connection registration | Credential Connection per tenant setup |

---

## Summary

| Category | Count |
|----------|-------|
| Compliant | 7 areas |
| Deviations requiring approval | 4 (TX-001–TX-004) |
| Intentional product deviations | 2 (TX-005, TX-007) |
| Low / operational | 1 (TX-006) |

**No Telnyx API misuse identified.** Primary gaps are **operational** (webhook URL config, idempotency) not API contract violations.
