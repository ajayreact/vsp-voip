# Telephony Audit — Phase 3.1

**Scope:** Call Control, webhooks, idempotency, race conditions, retries, timeouts, call/device cleanup, PSTN/extension routing.  
**Mode:** Read-only. Backend telephony frozen — findings for approved remediation only.

---

## Architecture reference

| Layer | Primary files |
|-------|---------------|
| Webhook ingress | `server.js` |
| Inbound Call Control FSM | `lib/inboundCallControl.js` |
| Session store | `lib/callControlSessionStore.js` |
| Telnyx commands | `lib/telnyxCallControl.js` |
| Internal extension dial | `lib/internalExtensionDial.js` |
| Ring groups | `lib/ringGroups.js`, `lib/ringGroupRouter.js` |
| Outbound recording | `lib/outboundRecording.js` |

---

## Findings

### TEL-001 — Dual webhook paths for Call Control events

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | `server.js` routes both `POST /webhook/call-control` and `POST /webhook/voice` to `handleInboundCallControlEvent()` for `call.*` events. |
| **Recommendation** | Configure Telnyx Mission Control so lifecycle events hit **one** URL only; monitor duplicate `call_control_id` + event type. |
| **Proposed fix** | Ops: single canonical URL; code: deprecate duplicate handler path after verification. |

---

### TEL-002 — No Telnyx event-ID deduplication

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | Unlike Stripe/Razorpay (`claimStripeEvent`, `claimRazorpayEvent`), Call Control processes every webhook delivery. Ack 200 then async `setImmediate` — Telnyx will not retry after ack, but duplicate deliveries from dual paths or edge retries are unguarded. |
| **Recommendation** | Redis `SET NX` on `telnyx:event:{id}` with TTL ≥ retry window (Telnyx docs). |
| **Proposed fix** | Phase 3.2: shared webhook dedup middleware. |

---

### TEL-003 — No idempotency guard on `call.initiated`

| Field | Detail |
|-------|--------|
| **Severity** | High |
| **Root cause** | `handleCallInitiated()` creates session and answers without checking existing session for `call_control_id`. |
| **Recommendation** | Short-circuit if session already past `init` state. |
| **Proposed fix** | `getSession()` guard before `answerCall()`. |

---

### TEL-004 — Redis unavailable → in-memory session store

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `callControlSessionStore.js` falls back to process memory when Redis fails; multi-instance deployments split brain. |
| **Recommendation** | `REDIS_REQUIRED=true` in production; alert on memory fallback log line. |
| **Proposed fix** | Fail `/ready` when Redis down in prod (already optional via env). |

---

### TEL-005 — Async webhook handlers without dead-letter

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | Handler errors logged to `console.error` only after 200 ack; no replay queue. |
| **Recommendation** | Persist failed payloads; admin replay tool. |
| **Proposed fix** | `WebhookDeadLetter` table or Redis list. |

---

### TEL-006 — `dialDestination()` omits `command_id`

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | Telnyx command dedup supported in transfer/bridge but not outbound dial (`lib/telnyxCallControl.js`). |
| **Recommendation** | Align with Telnyx Call Control API best practice. |
| **Proposed fix** | Stable `command_id` per dial leg in session state. |

---

### TEL-007 — Telnyx API single attempt, 20s timeout

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `telnyxApiRequest()` — no retry on 5xx/network blip. |
| **Recommendation** | Bounded retry for idempotent GETs; command retry with same `command_id`. |
| **Proposed fix** | Retry wrapper with exponential backoff. |

---

### TEL-008 — Recording start failures warn-only

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `applyAnswerSideEffectsOnce()` catches recording errors, logs warn. |
| **Recommendation** | Metric + optional tenant notification. |
| **Proposed fix** | Structured log + `recording_failed` audit event. |

---

### TEL-009 — In-memory telephony telemetry (100 events)

| Field | Detail |
|-------|--------|
| **Severity** | Medium |
| **Root cause** | `lib/telephonyHealth.js` — lost on restart; not shared across instances. |
| **Recommendation** | Persist race-prevention metrics to Redis or external APM. |
| **Proposed fix** | Export to Redis sorted set or Datadog. |

---

### TEL-010 — Session TTL 1 hour

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Root cause** | `SESSION_TTL_SEC = 3600`; long calls or delayed hangup webhooks may expire session early. |
| **Recommendation** | Refresh TTL on each webhook for active call. |
| **Proposed fix** | `EXPIRE` refresh in session update path. |

---

### TEL-011 — Legacy status webhook logs with `tenantId: null`

| Field | Detail |
|-------|--------|
| **Severity** | Low |
| **Root cause** | `handleTelnyxStatus` path may log CDR without tenant resolution. |
| **Recommendation** | Resolve tenant from dialed number before insert. |
| **Proposed fix** | DID lookup in status handler. |

---

## Positive controls (telephony)

| Control | Location |
|---------|----------|
| Full inbound FSM (IVR, ring groups, extension policies) | `inboundCallControl.js` |
| Atomic winner claim (`SET NX`) | `callControlSessionStore.js` |
| Bridge grace period | `BRIDGE_GRACE_PERIOD_MS` |
| Loser-leg hangup on simultaneous ring | `inboundCallControl.js` |
| `markAgentWebRtcAccepted()` accept-before-bridge | softphone + Call Control |
| `cleanupInboundSession()` clears indexes | `inboundCallControl.js` |
| TeXML greeting dedup (15s Redis) | `greetingDedup.js` |
| Messaging inbound dedup by `telnyxMessageId` | `MessagingService.js` |
| Telnyx signature verification | `telnyxVerify.js` |
| Four ring strategies (backend-validated) | `ringGroups.js` `VALID_STRATEGIES` |
| Member reorder API | `PATCH .../members/reorder` |

---

## Test coverage

| Area | Coverage |
|------|----------|
| Tenant isolation | `tests/telephony/tenant-extension-isolation.test.ts` |
| Call FSM | `tests/telephony/call-fsm.test.ts` |
| Orchestrator answer gate | `tests/telephony/orchestrator-answer-gate-replay.test.ts` |
| Inbound / outbound / transfer / voicemail | Multiple telephony test files |
| Race validation scripts | `scripts/validate-phase3b-race.js`, `validate-phase3b.js` |
| **Gap** | No automated test for webhook event-ID dedup or dual-path suppression |

---

## Summary

| Severity | Count |
|----------|-------|
| High | 3 |
| Medium | 6 |
| Low | 2 |

**Phase 3.2 priority:** TEL-001, TEL-002, TEL-003 (idempotency and duplicate delivery).
