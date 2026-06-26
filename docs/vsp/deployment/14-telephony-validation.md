# Telephony Validation

Complete checklist for validating VSP Phone telephony after deploy or incident. Run in order; stop and fix if a step fails.

**Prerequisites:** [10-production-checklist.md](./10-production-checklist.md) API/web health passes.

---

## 1. Registration

| Step | Action | Pass |
|------|--------|------|
| 1.1 | Open https://app.vspphone.com/softphone-v2 | Page loads |
| 1.2 | Log in with test tenant user | JWT valid |
| 1.3 | Softphone shows **Registered** / connected | Telnyx credential OK |
| 1.4 | Browser console — no registration errors | |
| 1.5 | `/ready` → `telnyx.apiKeyConfigured: true` | Server-side Telnyx |

Scripts: `npm run validate:p0`

---

## 2. Microphone & media permission

| Step | Action | Pass |
|------|--------|------|
| 2.1 | Browser prompts for mic — **Allow** | |
| 2.2 | OS privacy settings allow browser mic | |
| 2.3 | No physical mute / wrong input device | |
| 2.4 | Diagnostics: outbound `packetsSent` > 0 during speech | |

---

## 3. Inbound call

| Step | Action | Pass |
|------|--------|------|
| 3.1 | Call tenant DID from external phone | Rings in softphone |
| 3.2 | Answer call | State → active |
| 3.3 | **Two-way audio** — hear caller; caller hears you | |
| 3.4 | Telnyx debugger: `call.initiated` → `call.answered` | |
| 3.5 | API logs: webhook handled without error | |

---

## 4. Outbound call

| Step | Action | Pass |
|------|--------|------|
| 4.1 | Dial external number from softphone | Leaves "Calling…" |
| 4.2 | Remote party rings | |
| 4.3 | **Two-way audio** when answered | |
| 4.4 | Caller ID correct (if configured) | |

**If stuck on Calling…:** Telnyx Outbound Voice Profile on Credential Connection — see [11-known-issues.md](./11-known-issues.md).

---

## 5. Hold & mute

| Step | Action | Pass |
|------|--------|------|
| 5.1 | Mute — remote cannot hear you; unmute restores | |
| 5.2 | Hold — appropriate MOH/silence; resume works | |

---

## 6. Transfer

| Step | Action | Pass |
|------|--------|------|
| 6.1 | Blind transfer to extension or external number | Call completes |
| 6.2 | Original leg hangs up; destination connected | |
| 6.3 | No bridge race / dropped call | |

Scripts:

```bash
npm run validate:blind-transfer
npm run validate:call-transfer-session
```

---

## 7. Recording

| Step | Action | Pass |
|------|--------|------|
| 7.1 | Start recording during active call | |
| 7.2 | Stop recording | |
| 7.3 | Recording appears in portal `/recordings` | |
| 7.4 | Playback audio OK | |

Script: `npm run validate:recording-stream`

---

## 8. Voicemail

| Step | Action | Pass |
|------|--------|------|
| 8.1 | Send call to VM (no answer or VM extension) | |
| 8.2 | Leave message | |
| 8.3 | VM appears in portal `/voicemail` | |
| 8.4 | Audio playback OK | |

Script: `npm run validate:exclusive-voicemail-audio`

---

## 9. Call history

| Step | Action | Pass |
|------|--------|------|
| 9.1 | Completed call in `/calls` | Direction, duration, parties |
| 9.2 | CDR matches Telnyx debugger timing | |

---

## 10. Notifications

| Step | Action | Pass |
|------|--------|------|
| 10.1 | Inbound ring notification (browser) | If enabled |
| 10.2 | Mobile push (if testing mobile) | Separate APK deploy |

---

## 11. ICE / TURN / RTP (WebRTC)

Run during **active call** at [softphone-v2/diagnostics](https://app.vspphone.com/softphone-v2/diagnostics).

| Check | Healthy | Problem |
|-------|---------|---------|
| ICE connection state | `connected` or `completed` | `failed` → firewall/TURN |
| ICE gathering | `complete` | Stuck → network |
| Local candidate types | host + srflx and/or relay | No srflx/relay in strict NAT |
| Selected pair | Matches network (relay OK in office) | |
| outbound packetsSent | Increments while speaking | 0 → mic/send path |
| inbound packetsReceived | Increments while remote speaks | 0 → receive path |
| TURN | `turn.telnyx.com` reachable if relay used | Blocked → one-way audio |

Capture procedure: [scripts/office-webrtc-capture-checklist.md](../../../scripts/office-webrtc-capture-checklist.md)

Script: `npm run validate:inbound-media-phase1`

---

## 12. WebRTC Diagnostics page

| Step | Action | Pass |
|------|--------|------|
| 12.1 | Route `/softphone-v2/diagnostics` loads (not 404) | Frontend deployed |
| 12.2 | Metrics populate during active call | Registry wired |
| 12.3 | Export JSON succeeds | |

404 on diagnostics → run `deploy/deploy-web.sh`, not a telephony code fix.

---

## 13. DID sync & assignment

| Step | Action | Pass |
|------|--------|------|
| 13.1 | Admin sync numbers from Telnyx | |
| 13.2 | DID assigned to tenant | |
| 13.3 | Extension mapped to user | |

```bash
API_URL=https://api.vspphone.com node scripts/diagnose-did-sync.js
npm run validate:extension-did
npm run validate:did-assignment
```

---

## 14. Sign-off

- [ ] All sections passed or exceptions documented
- [ ] Deploy commit SHA recorded
- [ ] Diagnostics JSON attached if audio issues
- [ ] Telnyx debugger screenshot for failed calls

---

## Related docs

- [10-production-checklist.md](./10-production-checklist.md)
- [11-known-issues.md](./11-known-issues.md)
- [13-monitoring.md](./13-monitoring.md)
- [docs/telnyx/webrtc/](../../telnyx/webrtc/) — Telnyx WebRTC reference
