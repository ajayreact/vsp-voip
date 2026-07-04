# ADR: Voicemail

## Problem

Unanswered calls need tenant-branded voicemail capture without dropping active bridges or double-recording during race conditions.

## Decision

- Route to VM from Call Control FSM on no-answer, DND, after-hours, extension policy
- **Block VM** during bridge grace (`connecting`) and when active winner exists
- Flow: speak prompt → `startVoicemailRecording` → webhook save → hangup
- Persist to `Voicemail` with optional `extensionId` / `ringGroupId`
- TeXML path retained for legacy

Module: `lib/voicemail.js`, handlers in `lib/inboundCallControl.js`.

## Reason

Voicemail is a Call Control leg operation on PSTN caller — same FSM as routing, sharing session guards.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| Separate VM platform | Breaks tenant UX |
| Always send to VM on timeout | Drops active WebRTC bridge races |
| Email-only VM | No in-portal playback |

## Trade-offs

| Pro | Con |
|-----|-----|
| Integrated with routing | Complex guard conditions |
| Extension + ring group VM | TeXML + CC dual paths |
| Uses Telnyx recording | Same webhook routing as CDR |

## Future impact

- Transcription would hook post-`saveVoicemailFromCallControlEvent`
- VM-to-email notification uses existing SMTP infra

**Related:** [../pbx/14-voicemail.md](../pbx/14-voicemail.md), [bridge-grace.md](./bridge-grace.md)
