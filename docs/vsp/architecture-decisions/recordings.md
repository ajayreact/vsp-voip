# ADR: Call Recordings

## Problem

Tenants need compliant call recording with tenant-scoped storage, playback, and optional outbound agent-initiated recording.

## Decision

- **Inbound:** Auto-start via Call Control `startCallRecording` on answer when greeting/ring-group policy enables — guarded by `claimAnswerSideEffects`
- **Outbound:** Manual start via `POST /api/softphone/record-start`
- **Completion:** Telnyx `call.recording.saved` webhook → `saveCallRecordingFromCallControlEvent` → `CallRecording` row
- Optional spoken preamble via `playCallRecordingNotice`

## Reason

Telnyx records media on carrier side — VSP stores metadata and provides portal playback without handling RTP.

## Alternatives

| Alternative | Rejected because |
|-------------|------------------|
| Browser MediaRecorder | No PSTN leg capture |
| S3 direct upload from client | No unified CDR |
| Record all calls always | Compliance and storage cost |

## Trade-offs

| Pro | Con |
|-----|-----|
| Reliable PSTN+WebRTC capture | Telnyx storage dependency |
| Policy per tenant/greeting | Dual TeXML + CC webhook paths |
| Idempotent start | Recording delay until answer |

## Future impact

- Retention policies and encryption at rest
- Sync job already exists: `lib/recordingSync.js`

**Related:** [../pbx/13-call-recording.md](../pbx/13-call-recording.md)
