---
title: "Interpreting Debug Data"
source_url: "https://developers.telnyx.com/docs/voice/webrtc/troubleshooting/interpreting-debug-data.md"
category: "webrtc"
synced_at: "2026-06-25T18:37:31.538Z"
content_hash: "c69c4e0b985e4016f39d0cb6cda540740e3643f44ea6cadfdf6f1950512c3e6f"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Interpreting WebRTC Voice SDKs Debug Data

> Step-by-step guide to interpreting debug logs from the Telnyx Voice WebRTC SDKs — read INVITE/BYE flows, ICE candidates, and identify common errors.

<Callout type="warning">
  This is a beta feature with limited availability by SDK type. Data schema and/or presentation may change without notification.
</Callout>

To make full use of this guide, the reader is encouraged to complete the following steps in order to have a real world example to follow along.

1. Initiates an outbound call from a [properly configured](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/demo-app) `https://webrtc.telnyx.com/` with debug enabled and data sent over socket.
2. [Locate](https://developers.telnyx.com/docs/voice/webrtc/troubleshooting/debug-logs#locating-the-debug-data) the debug data.
3. Upload the data to `https://webrtc-debug.telnyx.com/`.

## Peer Configuration

<img src="https://mintcdn.com/telnyx/VYiRDGy8TCRNJLEC/img/peer-configuration.png?fit=max&auto=format&n=VYiRDGy8TCRNJLEC&q=85&s=9a5293c1fde1cfd535db2b81da5614ed" alt="" width="1350" height="726" data-path="img/peer-configuration.png" />

This section provides data on the configuration of the [RTCPeerConnection](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection).

If [`prefetchIceCandidates`](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/interfaces/icalloptions#prefetchicecandidates) is disabled, the pool size is set to 0. Otherwise, it's set to 255.

If [`forceRelayCandidate`](https://developers.telnyx.com/docs/voice/webrtc/js-sdk/interfaces/icalloptions#forcerelaycandidate) is enabled, then transport policy will be set to `relay`.

Lastly, by default, Telnyx SDKs use the following endpoints to gather ICE candidates.

* `stun.l.google.com`
* `stun.telnyx.com`
* `turn.telnyx.com`

## ICE Candidates & Candidate Pair

<img src="https://mintcdn.com/telnyx/tKcWw-YZ6CuwkRsC/img/ice-candidates.png?fit=max&auto=format&n=tKcWw-YZ6CuwkRsC&q=85&s=fa324ecb78937c11c40c2e48196a16dd" alt="" width="2686" height="826" data-path="img/ice-candidates.png" />

This section lists out all the [ICE candidates](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate) gathered prior to a call is established.

There will always be one `remote-candidate` of `host` type offered. This represents the Telnyx's end of the peer connection.

There will always be multiple `local-candidate` offered unless `relay` candidate was configured to be used.

For a call to be successfully established, at least one `local-candidate` of the following type must be present:

* `prflx`
* `srflx`
* `relay`

`host` candidate type cannot be used to establish peer connection over the internet.

If no viable `local-candidate` are present, it's highly likely that the SDK client is located on a very restrictive network where all UDP traffic is blocked and access to certain endpoints (turn.telnyx.com) are not allowed.

Barring that, there will be one pair of ICE candidates used for this call.

<img src="https://mintcdn.com/telnyx/33ANQJ-HKUTIlR5u/img/candidate-pair.png?fit=max&auto=format&n=33ANQJ-HKUTIlR5u&q=85&s=8e4d8815fe0b1d42bae1745d965e55a5" alt="" width="1350" height="522" data-path="img/candidate-pair.png" />

## RTT

<img src="https://mintcdn.com/telnyx/piPv--L_2q5NFR4U/img/rtt.png?fit=max&auto=format&n=piPv--L_2q5NFR4U&q=85&s=80cb406cd6da8af778296190a81dcec9" alt="" width="1348" height="1046" data-path="img/rtt.png" />

A high RTT value provides clues to voice delay.

## Packets Lost

A high packet lost value provides clues to skipped audio.

<img src="https://mintcdn.com/telnyx/VYiRDGy8TCRNJLEC/img/packet-lost.png?fit=max&auto=format&n=VYiRDGy8TCRNJLEC&q=85&s=1463ad63f357a37f4624bf8936fe16bd" alt="" width="1338" height="1048" data-path="img/packet-lost.png" />

## Jitter

A high jitter value provides clues to inconsistent audio quality throughout the call.

<img src="https://mintcdn.com/telnyx/JbAKfH7SbyeZcDpH/img/jitter.png?fit=max&auto=format&n=JbAKfH7SbyeZcDpH&q=85&s=9d115a85a32d1fb5cacb536048a485b6" alt="" width="1342" height="1042" data-path="img/jitter.png" />

## Other Useful Data

If the user is experiencing one way audio, it's worth checking inbound and outbound audio level to corroborate the user's claim.
