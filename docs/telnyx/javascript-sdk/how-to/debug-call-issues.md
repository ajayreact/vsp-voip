---
title: "Debug Data & Call Quality Analysis"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/how-to/debug-call-issues.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:38:52.176Z"
content_hash: "532439e282f241427a4ad5a8c59a0ad9245f7cad12ae02195c28696d56f9ad06"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Debug Data & Call Quality Analysis

> How to collect, interpret, and troubleshoot WebRTC call quality using debug reports, call reports, and the Telnyx debug visualizer.

# Debug Data & Call Quality Analysis

When calls have quality issues, the Telnyx WebRTC JS SDK provides multiple tools to diagnose the problem. This guide covers collecting debug data, interpreting results, and common troubleshooting patterns.

***

## Data Collection Methods

| Method               | When to Use           | Data Available                                     |
| -------------------- | --------------------- | -------------------------------------------------- |
| **Call Reports**     | Production monitoring | RTT, jitter, packet loss, ICE state, audio levels  |
| **Debug Reports**    | Deep troubleshooting  | Full WebRTC stats, SDP, ICE candidates, timestamps |
| **Console Debug**    | Development           | SDK internal logs, WebSocket messages              |
| **Debug Visualizer** | Visual analysis       | Charts of call quality over time                   |

***

## Method 1: Call Reports (Production)

Enable call reports for production quality monitoring:

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: jwt,
  enableCallReports: true,
  callReportInterval: 5000,
});
```

See [Monitor Call Quality](/development/webrtc/js-sdk/how-to/monitor-call-quality) for the full guide.

***

## Method 2: Debug Reports (Deep Troubleshooting)

Enable debug output for detailed troubleshooting data. Use `debug: true` with `debugOutput` to control where the data goes:

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: jwt,
  enableCallReports: true,  // Collect call stats
  debug: true,              // Enable debug mode
  debugOutput: 'file',      // Write debug data to a file
});
```

Debug data includes:

* Full ICE candidate list with timestamps
* DTLS handshake state
* SDP offer/answer with codec negotiation
* Packet-level stats (bytes, packets, loss per direction)
* Audio level measurements

### Accessing debug data

Call report data is available via the Call Report Stats API after the call ends:

```bash theme={null}
curl "http://voice-sdk-call-report-stats.query.prod.telnyx.io:4000/api/v1/calls/{user_id}/{call_id}"
```

### Interpreting debug data

**Key sections to check:**

| Section                  | What to Look For                                  |
| ------------------------ | ------------------------------------------------- |
| `ice_data.transport`     | DTLS state, ICE state, SRTP cipher                |
| `ice_data.selected_pair` | Which candidate pair is in use (host/srflx/relay) |
| `ice_data.candidates`    | All gathered candidates with timestamps           |
| `segments`               | Periodic RTT, jitter, packet loss measurements    |

***

## Method 3: Console Debug (Development)

Enable `debug: true` to get verbose SDK logging in the browser console:

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: jwt,
  debug: true,
});
```

This outputs SDK internal logs (WebSocket messages, ICE events, signaling) to the browser console. No additional configuration needed — `debug: true` enables console logging by default.

***

## Method 4: Debug Visualizer

Send debug output to the Telnyx debug visualizer for graphical analysis:

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: jwt,
  debug: true,
  debugOutput: 'socket',  // Send to visualizer
});
```

Open **[https://webrtc-debug.telnyx.com/](https://webrtc-debug.telnyx.com/)** in another tab to see the live visualization.

The visualizer shows:

* Call timeline with state transitions
* ICE candidate gathering progress
* DTLS handshake status
* Audio quality graphs (RTT, jitter, packet loss)
* Media flow direction

***

## Common Issues & Diagnosis

### One-Way Audio

**Check:**

1. Is DTLS connected? → `ice_data.transport.dtls_state === "connected"`
2. Is audio being sent? → Check `bytesSent` in stats
3. Is audio being received? → Check `bytesReceived` in stats
4. Which candidate type? → `ice_data.selected_pair` shows host/srflx/relay

**Common causes:**

* Asymmetric TURN relay (two nominated candidate pairs, one sending and one receiving)
* Firewall blocks media in one direction
* VPN interferes with ICE candidates

**Diagnosis from debug data:**

```
If dtls_state: "connecting" and ice_state: "connected"
→ DTLS handshake failing. Check for multiple NICs or asymmetric routing.

If bytesSent > 0 but bytesReceived = 0
→ Audio is being sent but not received. Check remote firewall.

If bytesSent = 0 and bytesReceived > 0
→ Audio is being received but not sent. Check local microphone permissions.
```

### Call Doesn't Connect

**Check:**

1. WebSocket state → `client.connection.connected`
2. ICE state → `ice_data.transport.ice_state`
3. STUN accessibility → Any `srflx` candidates?

**Common causes:**

* Firewall blocks `rtc.telnyx.com:443` (signaling)
* Firewall blocks `stun.telnyx.com:3478` (STUN)
* Firewall blocks `turn.telnyx.com:3478` (TURN over UDP/TCP, depending on path)
* No `relay` candidates and symmetric NAT

### Choppy Audio

**Check:**

1. Jitter → `stats.jitter > 50ms` is poor
2. Packet loss → `stats.packetLoss > 3%` is poor
3. RTT → `stats.rtt > 300ms` is poor

**Common causes:**

* WiFi congestion (high jitter)
* Network congestion (high packet loss)
* Long routing path (high RTT)
* VPN adding latency

### Echo

**Common causes:**

* Built-in speakers + mic without echo cancellation
* Two audio elements playing the same stream
* Headset echo cancellation not working

**Fix:**

* Recommend headphones
* Ensure only one audio element is active per call
* Check browser echo cancellation settings

***

## Quick Diagnostic Script

Run this in the browser console during a problematic call:

```javascript theme={null}
(async () => {
  const client = window.__telnyxClient; // Your client instance
  const calls = client.calls;

  console.log('=== Telnyx Call Diagnostic ===');
  console.log(`Active calls: ${calls.length}`);
  console.log(`Connected: ${client.connection.connected}`);

  for (const call of calls) {
    console.log(`
Call ${call.id}: state=${call.state}, direction=${call.direction}`);
    console.log(`  Remote: ${call.remotePartyNumber}`);

    const pc = call.peerConnection;
    if (pc) {
      const stats = await pc.getStats();
      stats.forEach(report => {
        if (report.type === 'candidate-pair' && report.nominated) {
          console.log(`  ICE: state=${report.state}, RTT=${report.currentRoundTripTime * 1000}ms`);
        }
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
          console.log(`  Audio In: packets=${report.packetsReceived}, lost=${report.packetsLost}, jitter=${report.jitter}`);
        }
        if (report.type === 'outbound-rtp' && report.kind === 'audio') {
          console.log(`  Audio Out: packets=${report.packetsSent}`);
        }
      });
    }
  }
})();
```

***

## See Also

* [Call Report Stats](/development/webrtc/js-sdk/call-report-stats) — Full stats API reference
* [Error Handling](/development/webrtc/js-sdk/how-to/error-handling) — Error and warning codes
* [Network Requirements](/development/webrtc/js-sdk/how-to/configure-network-firewall) — Firewall and connectivity
* [IClientOptions](/development/webrtc/js-sdk/interfaces/iclientoptions) — `debug`, `debugOutput`
* [Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices#audio-quality) — Quality monitoring
