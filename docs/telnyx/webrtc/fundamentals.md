---
title: "Fundamentals"
source_url: "https://developers.telnyx.com/docs/voice/webrtc/fundamentals.md"
category: "webrtc"
synced_at: "2026-06-25T18:35:23.456Z"
content_hash: "203a9651403e1fec0fce836550cb97a3b6e2c2dddbf536e00e9d986ac02e4d8c"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC Voice SDKs Fundamentals

> Core concepts for building real-time voice apps with the Telnyx Voice WebRTC SDKs — sessions, media negotiation, codecs, and call lifecycle basics.

## What & Why

These SDKs enable client-side applications to instantiate and control a Telnyx call leg.

As a result, developers of applications integrated with Telnyx voice platform are no longer constrained to working with inflexible and uncustomizable SIP UAs such as PBX, Asterisk, Zoiper etc.

Instead they can embed native voice capabilities client-side to work seamlessly with their voice application and achieve end to end visibility and control of the user experience.

## How

These SDKs

* Utilize the native client-end (browser or device) WebRTC API for cross browser/device compatibility, …
* Adhere to the WebRTC standardization where Media is transported via RTP over DTLS, aka SRTP, aka DTLS-SRTP, … and
* Implements the WebRTC session negotiation, aka signaling, via JSON-RPC messages over Secure WebSocket (WSS).

## Availability

The following SDKs are offered

* [Javascript SDK](https://github.com/team-telnyx/webrtc)
* [Native iOS SDK](https://github.com/team-telnyx/telnyx-webrtc-ios)
* [Native Android SDK](https://github.com/team-telnyx/telnyx-webrtc-android)
* [Flutter SDK](https://github.com/team-telnyx/flutter-voice-sdk)
