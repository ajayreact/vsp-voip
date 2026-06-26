# Telnyx Overview — VSP Phone Context

Telnyx is the carrier and CPaaS platform VSP Phone uses for programmable voice, WebRTC softphones, phone numbers, and call control.

## VSP Phone usage map

| Telnyx product | VSP component | Notes |
|----------------|---------------|-------|
| **Call Control Application** | `lib/inboundCallControl.js`, `lib/telnyxCallControl.js` | Inbound PSTN → WebRTC bridge, outbound legs, recordings |
| **JavaScript WebRTC SDK** | `web/src/app/(app)/softphone-v2/` | Browser softphone via `@telnyx/webrtc` |
| **Telephony credentials / JWT** | `routes/portal.js` → `/api/softphone/token` | Per-user WebRTC login tokens |
| **SIP credential connection** | Extension provisioning | `VSP-SIP-Trunk` style credential connections |
| **Phone Numbers API** | `lib/adminDidManagement.js`, DID routing | Search, assign, sync inventory |
| **Webhooks** | `routes/webhooks.js`, Call Control handlers | Signed Ed25519 payloads |
| **Recordings API** | Voicemail / call recording playback | Stream via Telnyx download URLs |
| **Transfer / Bridge commands** | `lib/callTransferControl.js` | Blind transfer via Call Control |

## Authentication

- **REST API:** `Authorization: Bearer <TELNYX_API_KEY>` against `https://api.telnyx.com/v2`
- **WebRTC clients:** Telephony credential JWT (`login_token`) or SIP credentials — see [authentication/](./authentication/) and [javascript-sdk/how-to/authenticating-your-app.md](./javascript-sdk/how-to/authenticating-your-app.md) after sync
- **Webhooks:** Verify Ed25519 signatures before trusting payloads

## Base URLs

| Service | URL |
|---------|-----|
| REST API | `https://api.telnyx.com/v2` |
| WebRTC signaling | `rtc.telnyx.com:443` |
| STUN | `stun.telnyx.com:3478` |
| TURN | `turn.telnyx.com:3478` / TCP 443 |

## Key SDK packages

| Package | VSP usage |
|---------|-----------|
| `@telnyx/webrtc` | Softphone V2 browser client |
| (server) REST | Direct `fetch` / axios in Node — no Telnyx Node SDK required |

## Documentation sources

Pages in this folder are synced from [developers.telnyx.com](https://developers.telnyx.com) via `scripts/update-telnyx-docs.js`, using Telnyx machine-readable indices (`llms.txt`).

## Related VSP docs

- Production Telnyx setup: `docs/launch/telnyx-go-live-guide.md`
- Telephony health: `docs/TELEPHONY-HEALTH-DASHBOARD.md`
- Deploy checklist: `deploy/PRODUCTION-CHECKLIST.md`
