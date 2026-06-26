---
title: "Call Report Stats"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/how-to/monitor-call-quality.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:38:24.728Z"
content_hash: "4d4beb95bc93c03234170a27e4e5edeb0f70e9551b125a379a8ca0e744866b6a"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Call Report Stats

> How to enable, access, and interpret WebRTC call reports from the Telnyx JS SDK — RTT, jitter, packet loss, ICE data, and audio quality metrics.

# Call Report Stats

The Telnyx WebRTC JS SDK can automatically collect WebRTC statistics during and after calls. Use call reports to monitor quality, diagnose issues, and build real-time quality indicators.

***

## Enabling Call Reports

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 enableCallReports: true, // Required (default: true)
 callReportInterval: 5000, // Stats every 5 seconds (default)
});
```

| Option               | Type      | Default | Description                           |
| -------------------- | --------- | ------- | ------------------------------------- |
| `enableCallReports`  | `boolean` | `true`  | Enable call report collection         |
| `callReportInterval` | `number`  | `5000`  | Interval in ms between periodic stats |

***

## Real-Time Stats (`telnyx.stats.frame`)

Fires periodically during an active call (every `callReportInterval` ms):

```javascript theme={null}
client.on('telnyx.stats.frame', (stats) => {
 console.log('RTT:', stats.rtt);
 console.log('Jitter:', stats.jitter);
 console.log('Packet loss:', stats.packetLoss);
});
```

### StatsFrame Properties

| Property          | Type     | Description                       |
| ----------------- | -------- | --------------------------------- |
| `rtt`             | `number` | Round-trip time in milliseconds   |
| `jitter`          | `number` | Jitter in milliseconds            |
| `packetLoss`      | `number` | Packet loss percentage            |
| `bytesSent`       | `number` | Total bytes sent                  |
| `bytesReceived`   | `number` | Total bytes received              |
| `packetsSent`     | `number` | Total RTP packets sent            |
| `packetsReceived` | `number` | Total RTP packets received        |
| `packetsLost`     | `number` | Total RTP packets lost            |
| `audioLevel`      | `number` | Current audio level (0.0 - 1.0)   |
| `timestamp`       | `number` | Unix timestamp of the measurement |

### Quality Thresholds

| Metric      | Good     | Fair      | Poor    |
| ----------- | -------- | --------- | ------- |
| RTT         | \< 150ms | 150-300ms | > 300ms |
| Jitter      | \< 20ms  | 20-50ms   | > 50ms  |
| Packet Loss | \< 1%    | 1-3%      | > 3%    |

### Building a quality indicator

```javascript theme={null}
client.on('telnyx.stats.frame', (stats) => {
 let quality = 'excellent';

 if (stats.rtt > 300 || stats.packetLoss > 3) {
 quality = 'poor';
 } else if (stats.rtt > 150 || stats.packetLoss > 1) {
 quality = 'fair';
 }

 updateQualityIndicator(quality);
});
```

### Quality warning events

The SDK also emits structured `telnyx.warning` events when quality or connectivity thresholds are crossed. Use these warnings to drive user-facing indicators and collect diagnostics without parsing raw stats yourself:

```javascript theme={null}
import { SwEvent, TELNYX_WARNING_CODES } from '@telnyx/webrtc';

client.on(SwEvent.Warning, ({ warning, callId }) => {
  switch (warning.code) {
    case TELNYX_WARNING_CODES.LOW_LOCAL_AUDIO:
      showMicrophoneWarning(callId);
      break;
    case TELNYX_WARNING_CODES.ICE_CANDIDATE_PAIR_CHANGED:
      logNetworkPathChange(callId);
      break;
  }
});
```

`LOW_LOCAL_AUDIO` means RTP may still be flowing, but local microphone level is too low or silent. Ask the user to check microphone selection, mute state, and operating system input gain.

`ICE_CANDIDATE_PAIR_CHANGED` means the selected ICE path changed mid-call. The call may continue normally, but frequent changes are useful diagnostics for VPN changes, Wi-Fi handoffs, NAT rebinding, or relay fallback.

***

## End-of-Call Report (`telnyx.stats.report`)

Fires when a call ends with a summary of the entire call:

```javascript theme={null}
client.on('telnyx.stats.report', (report) => {
 console.log('Call ended:', report.callId);
 console.log('Duration:', report.duration, 'seconds');
 console.log('Average RTT:', report.avgRtt);
});
```

***

## Call Report Stats API

For SDK 2.25.20+, call reports are also available via HTTP API:

```bash theme={null}
# Get full call report with ICE data
curl "http://voice-sdk-call-report-stats.query.prod.telnyx.io:4000/api/v1/calls/{user_id}/{call_id}"

# Get ICE candidate data
curl "http://voice-sdk-call-report-stats.query.prod.telnyx.io:4000/api/v1/calls/{user_id}/{call_id}/ice"
```

### API Response Structure

```json theme={null}
{
 "data": {
 "call": {
 "call_id": "98041520-...",
 "duration": 45,
 "sdk_version": "2.26.3",
 "telnyx_session_id": "...",
 "telnyx_leg_id": "..."
 },
 "segments": [
 {
 "timestamp": 1712000000,
 "bytesSent": 12345,
 "bytesReceived": 23456,
 "rtt": 45,
 "jitter": 3,
 "audioLevel": 0.5
 }
 ],
 "ice_data": {
 "transport": {
 "dtls_state": "connected",
 "ice_state": "connected",
 "srtp_cipher": "AES_CM_128_HMAC_SHA1_80"
 },
 "selected_pair": {
 "local_candidate": { "type": "relay", "ip": "64.16.248.1", "port": 50000 },
 "remote_candidate": { "type": "host", "ip": "10.239.207.80", "port": 50001 },
 "nominated": true,
 "state": "succeeded"
 },
 "candidates": [
 { "type": "host", "ip": "192.168.1.5", "port": 50000, "timestamp": 1712000000 },
 { "type": "srflx", "ip": "203.0.113.5", "port": 50000, "timestamp": 1712000001 },
 { "type": "relay", "ip": "64.16.248.1", "port": 50000, "timestamp": 1712000002 }
 ]
 },
 "logs": ["SDK console log entries if captured"]
 }
}
```

### Key Fields for Diagnostics

| Field           | Path                             | What It Tells You                                             |
| --------------- | -------------------------------- | ------------------------------------------------------------- |
| DTLS state      | `ice_data.transport.dtls_state`  | `"connected"` = media encrypted , `"connecting"` = DTLS stuck |
| ICE state       | `ice_data.transport.ice_state`   | `"connected"` = ICE worked                                    |
| SRTP cipher     | `ice_data.transport.srtp_cipher` | Null = no encryption (DTLS failed)                            |
| Selected pair   | `ice_data.selected_pair`         | Which candidate pair is actually in use                       |
| Candidate types | `ice_data.candidates[].type`     | `host` = direct, `srflx` = STUN, `relay` = TURN               |

***

## Diagnosing Issues from Call Reports

### DTLS stuck ("connecting")

```
ice_data.transport.dtls_state: "connecting"
ice_data.transport.ice_state: "connected"
ice_data.transport.srtp_cipher: null
```

**Cause:** ICE succeeded but DTLS handshake failed. Usually a network issue where DTLS packets from one side aren't reaching the other (asymmetric routing, multiple NICs, firewall).

**Action:** Check if client has multiple network interfaces. See [Best Practices → Network](/development/webrtc/js-sdk/how-to/production-best-practices#audio-quality).

### All relay candidates

```
ice_data.candidates: [
 { type: "relay", ... },
 { type: "relay", ... }
]
```

**Cause:** Client can't generate host or srflx candidates. Likely behind strict NAT or VPN.

**Action:** Check firewall settings. If expected (e.g., for privacy), set `forceRelayCandidate: true`.

### No candidates at all

```
ice_data.candidates: []
```

**Cause:** STUN/TURN servers unreachable, or browser denied media permissions before ICE gathering started.

**Action:** Check network connectivity to `stun.telnyx.com` and `turn.telnyx.com`. See [Network Requirements](/development/webrtc/js-sdk/how-to/configure-network-firewall).

***

## See Also

* [IClientOptions](/development/webrtc/js-sdk/interfaces/iclientoptions) — `enableCallReports`, `callReportInterval`
* [Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices#audio-quality) — Quality monitoring guidance
* [Network Requirements](/development/webrtc/js-sdk/how-to/configure-network-firewall) — ICE/STUN/TURN configuration
* [Debug Data & Call Quality Analysis](/development/webrtc/js-sdk/how-to/debug-call-issues) — Interpreting debug output
