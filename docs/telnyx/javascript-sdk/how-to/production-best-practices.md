---
title: "Production Best Practices"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/how-to/production-best-practices.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:39:12.682Z"
content_hash: "6ad58aa9fd88872c42157c999b85cde32609629e166f434ec7006bb0c6eab4aa"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Production Best Practices

> Production deployment guide for the Telnyx WebRTC JS SDK — security, reliability, performance, and monitoring.

# Production Best Practices

Going from "it works on my machine" to "it works for all users, reliably" requires addressing security, reliability, performance, and monitoring. This guide covers the key areas.

***

## Authentication

### Use JWT in production

```javascript theme={null}
// Production
const client = new TelnyxRTC({ login_token: jwt });

// Development only
const client = new TelnyxRTC({ login: 'user', password: 'pass' });
```

JWTs are time-limited, revocable, and don't expose passwords. See [Authenticating Your App](/development/webrtc/js-sdk/how-to/authenticating-your-app).

### Generate JWTs on your backend

```javascript theme={null}
// Backend generates token — API key never reaches the browser
app.post('/api/telnyx-token', async (req, res) => {
 const token = await telnyx.telephonyCredentials.createToken(credentialId);
 res.json({ token });
});

// Never do this — API key in browser source
const response = await fetch('https://api.telnyx.com/v2/telnyx_rtc/access_tokens', {
 headers: { Authorization: `Bearer ${API_KEY}` }, // API_KEY exposed!
});
```

### Handle token refresh

```javascript theme={null}
client.on('telnyx.notification', (notification) => {
 if (notification.type === 'userMediaError') return;

 // Check for token expiring soon
 if (notification.type === 'callUpdate' && notification.call?.state === 'destroyed') {
 // If disconnected due to auth, try refresh
 }
});

// Or use the session event
client.on('telnyx.ready', () => {
 console.log('Connected and authenticated');
});
```

### One credential per user

Never share a Telephony Credential across multiple users. Each user must have their own JWT to ensure they receive their own incoming calls.

***

## Connection Management

### One client instance per tab

```javascript theme={null}
// Create once
let client = null;

function getClient() {
 if (!client) {
 client = new TelnyxRTC({ login_token: getJwt() });
 client.connect();
 }
 return client;
}

// Creating multiple instances
const client1 = new TelnyxRTC({ login_token: jwt }); // WebSocket 1
const client2 = new TelnyxRTC({ login_token: jwt }); // WebSocket 2 — wasteful
```

### Clean up on page unload

```javascript theme={null}
window.addEventListener('beforeunload', () => {
 if (client) {
 client.calls.forEach(call => call.hangup());
 client.disconnect();
 }
});
```

### Handle reconnection gracefully

```javascript theme={null}
client.on('telnyx.notification', (notification) => {
 if (notification.type === 'callUpdate') {
 const call = notification.call;
 if (call.state === 'reconnecting') {
 showBanner('Connection lost. Reconnecting...');
 } else if (call.state === 'active' && wasReconnecting) {
 hideBanner();
 }
 }
});
```

See [Handle Reconnection](/development/webrtc/js-sdk/how-to/handle-reconnection) for the full guide.

***

## Audio Quality

### Request microphone with constraints

```javascript theme={null}
const call = client.newCall({
 destinationNumber: '+12345678900',
 audio: true,
 // SDK handles getUserMedia internally
});
```

If you need to control the microphone before making a call:

```javascript theme={null}
const stream = await navigator.mediaDevices.getUserMedia({
 audio: {
 echoCancellation: true,
 noiseSuppression: true,
 autoGainControl: true,
 },
});
```

### Monitor call quality

Enable call reports in production:

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 enableCallReports: true,
 callReportInterval: 5000,
});
```

Set up quality alerts:

```javascript theme={null}
client.on('telnyx.notification', (notification) => {
 if (notification.type === 'callQuality') {
 const { mos, rtt, jitter, packetLoss } = notification.callQuality;
 if (mos < 3.0 || rtt > 500 || jitter > 100 || packetLoss > 5) {
 logQualityIssue(notification);
 }
 }
});
```

### Recommend headphones for agents

Built-in speakers + microphone create echo. For call center agents, recommend USB headsets or enforce echo cancellation.

***

## Network Configuration

### Allowlist Telnyx domains

Ensure your firewall allows:

| Domain            | Port | Protocol        | Purpose       |
| ----------------- | ---- | --------------- | ------------- |
| `rtc.telnyx.com`  | 443  | WebSocket (TLS) | Signaling     |
| `stun.telnyx.com` | 3478 | UDP             | STUN (ICE)    |
| `turn.telnyx.com` | 3478 | UDP             | TURN relay    |
| `turn.telnyx.com` | 3478 | TCP             | TURN fallback |
| `api.telnyx.com`  | 443  | HTTPS           | REST API      |

### Don't force relay unless necessary

```javascript theme={null}
// Only if you have a specific security requirement
const client = new TelnyxRTC({
 login_token: jwt,
 forceRelayCandidate: true, // Forces all media through TURN
});

// Default — lets ICE find the best path
const client = new TelnyxRTC({
 login_token: jwt,
});
```

Forcing relay adds 20-80ms latency per direction. Use it only when corporate policy requires all media to go through a relay.

See [Configure Network & Firewall](/development/webrtc/js-sdk/how-to/configure-network-firewall) for the full guide.

***

## Error Handling

### Always handle errors

```javascript theme={null}
client.on('telnyx.notification', (notification) => {
 if (notification.type === 'userMediaError') {
 const { code, message } = notification.error;

 switch (code) {
 case 1: // Not allowed
 showError('Microphone access denied. Please allow access in browser settings.');
 break;
 case 2: // Not found
 showError('No microphone detected. Please connect a microphone.');
 break;
 case 3: // Not readable
 showError('Microphone in use by another application.');
 break;
 }
 }
});
```

### Handle connection failures

```javascript theme={null}
client.on('telnyx.socket.close', () => {
 showError('Connection to Telnyx lost. Attempting to reconnect...');
});

client.on('telnyx.socket.error', (error) => {
 logError('WebSocket error', error);
});
```

### Don't show raw errors to users

```javascript theme={null}
// Technical error exposed to user
showError(`Call failed: ${error.message}`);

// User-friendly message
showError('Unable to connect the call. Please try again.');
```

***

## Memory Management

### Clean up call references

```javascript theme={null}
client.on('telnyx.notification', (notification) => {
 if (notification.call?.state === 'destroyed') {
 // Remove call from your state
 removeCallFromState(notification.call.id);
 }
});
```

### Remove event listeners

```javascript theme={null}
// When component unmounts (React example)
useEffect(() => {
 const handler = (notification) => { /* ... */ };
 client.on('telnyx.notification', handler);

 return () => {
 client.off('telnyx.notification', handler);
 };
}, []);
```

***

## Monitoring & Observability

### Enable call reports

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 enableCallReports: true, // Auto-upload reports after each call
 callReportInterval: 5000, // Stats every 5 seconds
});
```

### Track key metrics

| Metric      | Good     | Warning   | Critical |
| ----------- | -------- | --------- | -------- |
| MOS         | > 4.0    | 3.0–4.0   | \< 3.0   |
| RTT         | \< 150ms | 150–300ms | > 300ms  |
| Jitter      | \< 20ms  | 20–50ms   | > 50ms   |
| Packet Loss | \< 1%    | 1–3%      | > 3%     |

### Log quality issues server-side

```javascript theme={null}
client.on('telnyx.notification', (notification) => {
 if (notification.type === 'callQuality') {
 sendToMonitoring({
 callId: notification.call.id,
 mos: notification.callQuality.mos,
 timestamp: Date.now(),
 });
 }
});
```

***

## Deployment Checklist

| Requirement                                       | Details                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Authentication uses JWT                           | `login_token` in production, not `login`+`password`                  |
| JWT generated on backend                          | API key never in browser                                             |
| Token refresh handles `TOKEN_EXPIRING_SOON`       | Call `client.updateToken()` on warning code 34001                    |
| `beforeunload` disconnects client                 | Hang up calls and call `client.disconnect()`                         |
| `enableCallReports: true`                         | Automatic call reports for production monitoring                     |
| Error handling covers key events                  | `userMediaError`, `socket.close`, `socket.error`                     |
| Firewall allows Telnyx domains                    | `rtc.telnyx.com:443`, `stun.telnyx.com:3478`, `turn.telnyx.com:3478` |
| Reconnection UI shown during `reconnecting` state | Users should see connection status                                   |
| Call references cleaned up on `destroyed` state   | Prevent memory leaks                                                 |
| No `forceRelayCandidate: true` unless required    | Forced relay adds 20-80ms latency                                    |
| Quality metrics logged to monitoring              | Track MOS, RTT, jitter, packet loss                                  |
| User-friendly error messages                      | No raw errors shown to users                                         |

***

## See Also

* [Authenticating Your App](/development/webrtc/js-sdk/how-to/authenticating-your-app)
* [Configure Network & Firewall](/development/webrtc/js-sdk/how-to/configure-network-firewall)
* [Handle Reconnection](/development/webrtc/js-sdk/how-to/handle-reconnection)
* [Monitor Call Quality](/development/webrtc/js-sdk/how-to/monitor-call-quality)
* [Debug Call Issues](/development/webrtc/js-sdk/how-to/debug-call-issues)
* [Error Handling](/development/webrtc/js-sdk/how-to/error-handling)
