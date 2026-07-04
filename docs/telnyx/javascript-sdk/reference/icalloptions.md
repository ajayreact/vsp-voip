---
title: "ICallOptions"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/reference/icalloptions.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:39:48.072Z"
content_hash: "a2126fba1b2257a4214d1590ae51bacdd0381aa45a9d67d1be718f70a9d931ba"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# ICallOptions

> Configuration options for placing a call with the Telnyx WebRTC JS SDK.

# ICallOptions

Options passed to `client.newCall(options)` to configure call behavior.

***

## Quick Reference

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',  // Required
  audio: true,                        // Required
  callerName: 'John Doe',             // Optional caller ID
  trickleIce: true,                   // Faster call setup
});
```

***

## Required Properties

| Property            | Type      | Description                                                                                                     |
| ------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| `destinationNumber` | `string`  | Phone number or SIP URI to call. Use E.164 format for PSTN (e.g., `+12345678900`) or `sip:user@domain` for SIP. |
| `audio`             | `boolean` | Enable audio for this call. Always `true` for voice calls.                                                      |

***

## Call Identity

Customize how the call appears to the remote party.

| Property        | Type          | Default | Description                                                                                 |
| --------------- | ------------- | ------- | ------------------------------------------------------------------------------------------- |
| `callerName`    | `string`      | —       | Display name shown to the remote party (Caller ID name)                                     |
| `callerNumber`  | `string`      | —       | Phone number shown to the remote party (Caller ID number)                                   |
| `customHeaders` | `SipHeader[]` | —       | Custom SIP headers to include in the INVITE. Each header has `name` and `value` properties. |

**Example — Custom caller ID:**

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  callerName: 'Acme Corp',
  callerNumber: '+18005551234',
  customHeaders: [
    { name: 'X-Customer-ID', value: '12345' },
    { name: 'X-Agent-Name', value: 'john.doe' },
  ],
});
```

***

## ICE & Network

Control how the call establishes media connectivity.

| Property                | Type             | Default | Description                                                                                                     |
| ----------------------- | ---------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `trickleIce`            | `boolean`        | `true`  | Send ICE candidates incrementally instead of waiting for all to gather. **Keep enabled for faster call setup.** |
| `prefetchIceCandidates` | `boolean`        | `true`  | Pre-gather ICE candidates before the call is placed. Reduces call setup time.                                   |
| `forceRelayCandidate`   | `boolean`        | `false` | Force all media through TURN relay servers. Hides the client's public IP. Adds latency.                         |
| `iceServers`            | `RTCIceServer[]` | Auto    | Custom ICE servers. Overrides the SDK's default STUN/TURN configuration.                                        |

**Example — Force TURN for privacy:**

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  forceRelayCandidate: true,  // All media through TURN
});
```

**Example — Custom ICE servers:**

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  iceServers: [
    { urls: 'stun:stun.custom.com:3478' },
    {
      urls: 'turn:turn.custom.com:443',
      username: 'myuser',
      credential: 'mypass',
    },
  ],
});
```

<Callout type="info">
  The SDK automatically provisions STUN/TURN servers. Only override `iceServers` if you have custom infrastructure. See [Network Requirements](/development/webrtc/js-sdk/how-to/configure-network-firewall).
</Callout>

***

## Media Configuration

Control audio devices and streams.

| Property             | Type                      | Default      | Description                                                      |
| -------------------- | ------------------------- | ------------ | ---------------------------------------------------------------- |
| `localElement`       | `HTMLAudioElement`        | Auto-created | HTML element for playing local audio (hearing yourself)          |
| `remoteElement`      | `HTMLAudioElement`        | Auto-created | HTML element for playing remote audio (hearing the other party)  |
| `localStream`        | `MediaStream`             | —            | Custom local media stream. Use to provide a pre-obtained stream. |
| `remoteStream`       | `MediaStream`             | —            | Custom remote media stream.                                      |
| `preferred_codecs`   | `RTCRtpCodecCapability[]` | —            | Preferred audio codecs. Defaults to Opus.                        |
| `sdpASBandwidthKbps` | `number`                  | —            | Bandwidth limit in kbps (set in SDP AS attribute)                |

**Example — Custom audio elements:**

```javascript theme={null}
const remoteAudio = document.getElementById('remoteAudio');
const localAudio = document.getElementById('localAudio');

const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  remoteElement: remoteAudio,
  localElement: localAudio,
});
```

**Example — Pre-obtained media stream:**

```javascript theme={null}
// Get microphone access before placing the call
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  localStream: stream,
});
```

***

## Advanced

| Property          | Type      | Default | Description                                        |
| ----------------- | --------- | ------- | -------------------------------------------------- |
| `sessionId`       | `string`  | —       | Custom session ID for call correlation             |
| `retryBucketId`   | `string`  | —       | ID for call retry bucket                           |
| `timeoutSecs`     | `number`  | —       | Call setup timeout in seconds                      |
| `telnyxSessionId` | `string`  | —       | Telnyx session ID (for re-attach scenarios)        |
| `telnyxCallId`    | `string`  | —       | Telnyx call ID (for re-attach scenarios)           |
| `isRecovered`     | `boolean` | —       | Whether this call was recovered after reconnection |

***

## Common Patterns

### Basic voice call

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
});
```

### Call with SIP URI

```javascript theme={null}
const call = client.newCall({
  destinationNumber: 'sip:agent@customer.sip.telnyx.com',
  audio: true,
});
```

### Call with custom headers (for Call Control correlation)

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  customHeaders: [
    { name: 'X-Call-Session', value: sessionUuid },
  ],
});
```

### Privacy-focused call (force TURN)

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  forceRelayCandidate: true,
});
```

***

## See Also

* [Call Class](/development/webrtc/js-sdk/classes/call) — Call control methods (answer, hangup, mute, hold)
* [IClientOptions](/development/webrtc/js-sdk/interfaces/iclientoptions) — Client-level configuration
* [Network Requirements](/development/webrtc/js-sdk/how-to/configure-network-firewall) — ICE/STUN/TURN configuration
* [Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices#call-management) — Call management best practices
