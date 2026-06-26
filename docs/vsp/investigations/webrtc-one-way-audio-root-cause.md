# VSP Phone – WebRTC One-Way Audio Root Cause Investigation (Authoritative Specification)

## Objective

Determine the exact root cause of the desktop WebRTC one-way audio issue.

**Current symptom:**

* Calls connect successfully.
* Remote audio is always heard.
* Remote party cannot hear the local microphone.
* Mobile browser works.
* Desktop browser has one-way audio.
* Stable v1.0 and latest version both exhibit the issue.

Do **NOT** implement speculative fixes.

The goal is to **prove** the root cause before modifying production telephony code.

---

# Development Freeze

Until this investigation is complete:

DO NOT modify:

* PBX Features
* DID Management
* Call Control
* Bridge Grace
* Routing
* Voicemail
* Recording
* Transfer
* UI
* Authentication
* Business Logic
* Database
* Prisma
* Redis
* API behavior

The ONLY permitted investigation branch is:

```
experiment/sdk-parity
```

Nothing from this branch may be merged until the investigation concludes.

---

# Mandatory Search Order

Before making any recommendation:

1. docs/vsp/
2. docs/telnyx/
3. Existing VSP source code
4. Official Telnyx documentation (only if local documentation is insufficient)

Never skip this order.

---

# Baseline Verification

Before any experiment record:

* Git branch
* Git commit
* Browser (Chrome or Edge)
* Browser version
* Windows version
* Selected microphone device
* Network (home / office)
* Telnyx SDK version

Include this information in the investigation log.

---

# Phase 1 — Official Telnyx Demo

Use the browser that normally reproduces the issue.

Requirements:

* Same Windows PC
* Same browser
* Same microphone
* Same network
* Same Telnyx login token
* Official Telnyx Production Demo (NOT development mode)

Do NOT modify any code.

Record ONLY:

✅ Two-way audio

OR

❌ One-way audio

OR

❌ Registration failed

Nothing else.

---

# Phase 2 — VSP Softphone

Immediately after Phase 1.

Use:

* Same browser
* Same PC
* Same microphone
* Same network
* Same account
* Same destination number

Record ONLY:

✅ Two-way audio

OR

❌ One-way audio

OR

❌ Registration failed

Nothing else.

---

# Decision Gate

## CASE 1

Official Demo ❌

VSP ❌

STOP ALL VSP MEDIA INVESTIGATION.

Do NOT modify VSP code.

Investigate ONLY:

* Windows microphone
* Browser permissions
* Browser extensions
* Default recording device
* VPN
* Firewall
* Antivirus / Security software
* Telnyx runtime/account

End investigation.

---

## CASE 2

Official Demo ✅

VSP ❌

Proceed to:

```
experiment/sdk-parity
```

Purpose:

Determine whether matching the official Telnyx media lifecycle restores two-way audio.

This is an experiment only.

DO NOT merge.

---

# SDK-Parity Experiment

Implement ONE stage at a time.

Never combine stages.

Run one outbound call and one inbound call after every stage.

If any stage restores two-way audio:

STOP.

Document the root cause.

Do NOT continue.

---

## Stage A

Goal:

Match the official Telnyx outbound media lifecycle.

Only change:

Outbound media ownership.

Let the SDK acquire and own the microphone.

Keep unchanged:

* Remote playback
* Authentication
* Call Control
* Bridge Grace
* Routing
* UI
* Business logic

Test:

Outbound

Inbound

If fixed:

STOP.

Document.

---

## Stage B

Only if Stage A fails.

Match the official Telnyx inbound answer flow.

Only change:

Inbound answer media lifecycle.

Do NOT change anything else.

Test again.

If fixed:

STOP.

Document.

---

## Stage C

Only if Stage B fails.

Temporarily disable ONLY the custom send-path maintenance.

Examples:

* wireWebCallAudio
* verifyLocalAudioSenders
* sender refresh loop

Keep remote playback intact.

Test:

Outbound

Inbound

If fixed:

STOP.

Document.

---

# Phase 4

Only if Stages A, B and C ALL fail.

Collect runtime evidence ONLY.

No fixes.

Collect:

* edge://webrtc-internals
* SDP Offer
* SDP Answer
* RTP statistics
* RTCRtpSender state
* packetsSent
* bytesSent
* totalAudioEnergy
* audioLevel
* sender.track.enabled
* sender.track.readyState
* Existing diagnostics JSON
* Existing send-path probe logs

Determine the first failing stage.

Only after proving the failing stage may a fix be proposed.

---

# Investigation Log

Maintain this table throughout the investigation.

| Step     | Result             | Stop?        |
| -------- | ------------------ | ------------ |
| Baseline | Complete           |              |
| Phase 1  | Pass / Fail        |              |
| Phase 2  | Pass / Fail        |              |
| Stage A  | Pass / Fail        | Stop if Pass |
| Stage B  | Pass / Fail        | Stop if Pass |
| Stage C  | Pass / Fail        | Stop if Pass |
| Phase 4  | Evidence Collected |              |
| Production fix | Implemented  |              |
| Definition of Done | Pass / Fail | Required to close |

---

# Success Criteria

Produce ONE final conclusion only.

Either:

**Environment Issue**

or

**VSP Media Lifecycle Issue**

If VSP Media Lifecycle is confirmed:

Identify the smallest code difference from the official Telnyx implementation that restores two-way audio.

Do NOT continue making additional telephony changes after the root cause is identified.

---

# Definition of Done

The WebRTC one-way audio investigation is considered **complete** only when all of the following are true.

## Functional Verification

The same build successfully completes:

* Outbound desktop → PSTN call
* Inbound PSTN → desktop call

For both directions:

* Remote hears local microphone continuously.
* Local hears remote continuously.
* Call remains connected for at least 60 seconds.
* Mute and unmute continue to function correctly.

## Cross-Browser Verification

Verify using every supported desktop browser:

* Google Chrome
* Microsoft Edge

(Optional: Firefox if officially supported.)

## Cross-Network Verification

Verify on:

* Home network
* Office network (if previously reproducible)

## Regression Verification

Confirm that the following still work without regression:

* Softphone registration
* Outbound calls
* Inbound calls
* Blind transfer
* Call recording
* Voicemail
* Bridge Grace
* DID routing
* Multi-tenant isolation

## Documentation

Record:

* Root cause
* Evidence supporting the conclusion
* Exact commit that resolved the issue
* Why the fix works
* Why alternative hypotheses were rejected

## Merge Criteria

The SDK-parity experiment branch must **NOT** be merged directly.

If the experiment identifies the root cause:

1. Implement the smallest production fix.
2. Re-test all Definition of Done items.
3. Merge only the production fix.
4. Archive the experiment branch for future reference.

---

This document is the authoritative runbook for the WebRTC one-way audio investigation.

**Investigation phases (1–4, SDK-parity)** prove root cause. **Definition of Done** is required before the development freeze lifts and any production fix merges.

---

**Related:** [../pbx/04-webrtc-media.md](../pbx/04-webrtc-media.md), [../architecture-decisions/diagnostics.md](../architecture-decisions/diagnostics.md), [../../scripts/office-webrtc-capture-checklist.md](../../scripts/office-webrtc-capture-checklist.md)
