# Telnyx Go-Live Guide

Validate Telnyx production configuration before customer calls go live.

---

## Prerequisites

- Telnyx account funded (balance for number purchases + usage)
- Production API at public HTTPS URL
- `TELNYX_API_KEY` and `TELNYX_PUBLIC_KEY` in production secrets

---

## 1. Environment variables

```env
TELNYX_API_KEY=KEYxxxxxxxx
TELNYX_PUBLIC_KEY=your-ed25519-public-key
TELNYX_MESSAGING_PROFILE_ID=xxxxxxxx   # if using SMS
API_PUBLIC_URL=https://api.YOUR_DOMAIN.com
```

---

## 2. Webhook endpoints

Set these in Telnyx Mission Control Portal:

| Telnyx resource | Webhook URL | Method |
|-----------------|-------------|--------|
| **TeXML Application** (inbound voice) | `{API_PUBLIC_URL}/webhook` | POST |
| **TeXML Call progress** | `{API_PUBLIC_URL}/webhook/status` | POST |
| **Call Control Application** | `{API_PUBLIC_URL}/webhook/call-control` | POST |
| **Credential Connection** (outbound recordings) | `{API_PUBLIC_URL}/webhook/voice` | POST |
| **Messaging Profile** (SMS) | `{API_PUBLIC_URL}/webhook/sms` | POST |
| **Voicemail** (TeXML action) | `{API_PUBLIC_URL}/webhook/voicemail` | POST |
| **Call recording callback** | `{API_PUBLIC_URL}/webhook/call-recording` | POST |

On startup with `API_PUBLIC_URL` set, the API attempts to auto-configure webhooks via `ensureTelnyx*Setup()` — verify in logs.

---

## 3. Webhook signature verification

Production requires `TELNYX_PUBLIC_KEY`. Unsigned webhooks are **rejected** when `WEBHOOK_STRICT=true` (default in production).

Verify headers on inbound requests:

- `telnyx-signature-ed25519`
- `telnyx-timestamp`

---

## 4. Validation checklist

### Voice (inbound TeXML)

| Step | Action | Done |
|------|--------|------|
| 1 | Assign test number to TeXML or Call Control app | ☐ |
| 2 | Link number to tenant in VSP-VOIP | ☐ |
| 3 | Call test number from mobile | ☐ |
| 4 | Confirm greeting / ring group plays | ☐ |
| 5 | Check API logs for webhook receipt | ☐ |
| 6 | Confirm `CallLog` row created | ☐ |

### Call Control (mobile / WebRTC inbound)

| Step | Action | Done |
|------|--------|------|
| 1 | Number assigned to Call Control app | ☐ |
| 2 | User logged into softphone / mobile | ☐ |
| 3 | Inbound call rings app | ☐ |
| 4 | Answer + hangup completes cleanly | ☐ |
| 5 | Suspended tenant receives reject message | ☐ |

### Outbound

| Step | Action | Done |
|------|--------|------|
| 1 | User selects owned caller ID | ☐ |
| 2 | Outbound call connects | ☐ |
| 3 | Call recording starts (if enabled) | ☐ |
| 4 | Call log + recording saved | ☐ |

### SMS

| Step | Action | Done |
|------|--------|------|
| 1 | Messaging profile webhook set | ☐ |
| 2 | Number on messaging profile | ☐ |
| 3 | Send outbound SMS from portal | ☐ |
| 4 | Receive inbound SMS | ☐ |
| 5 | Suspended tenant SMS blocked | ☐ |

### Number purchasing

| Step | Action | Done |
|------|--------|------|
| 1 | Authenticated number search works | ☐ |
| 2 | Stripe checkout completes → numbers purchased on Telnyx | ☐ |
| 3 | Numbers assigned to tenant + connection | ☐ |
| 4 | Quota enforcement blocks over-limit purchase | ☐ |

---

## 5. Startup auto-sync

When `API_PUBLIC_URL` is set, server startup runs:

- `ensureTelnyxRecordingSetup`
- `ensureTelnyxMessagingSetup`
- `ensureTelnyxCallControlSetup`

Review startup logs for `✅` confirmation lines.

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Inbound call silent / fast busy | Webhook URL wrong or signature failing |
| Mobile app doesn't ring | Number on Call Control app, not TeXML only |
| SMS not received | Messaging profile webhook + number assignment |
| Duplicate greetings | Redis required in production for dedup |
| 403 on webhooks | Check `TELNYX_PUBLIC_KEY` matches Telnyx portal |

---

## 7. Go-live sign-off

| Check | Pass |
|-------|------|
| Inbound test call successful | ☐ |
| Outbound test call successful | ☐ |
| SMS send/receive (if customer uses SMS) | ☐ |
| Number purchase end-to-end | ☐ |
| `/ready` → `telnyx.apiKeyConfigured: true` | ☐ |

**Signed off by:** _______________ **Date:** _______________
