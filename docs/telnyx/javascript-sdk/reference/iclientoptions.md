---
title: "IClientOptions"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/reference/iclientoptions.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:39:38.471Z"
content_hash: "a5fbf52ee7eef55d225bb8342ab1796971144ff31f854524b5d1967240c8f98b"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# IClientOptions

> Configuration options for the TelnyxRTC client — authentication, connection, ICE, call reports, and debugging.

# IClientOptions

Options passed to the `TelnyxRTC` constructor to configure the client.

***

## Quick Reference

```javascript theme={null}
import { TelnyxRTC } from '@telnyx/webrtc';

const client = new TelnyxRTC({
 login_token: 'YOUR_JWT_TOKEN', // Authentication (required)
 enableCallReports: true, // Call quality monitoring (default: true)
 debug: false, // Debug output
});
```

***

## Authentication

Choose one authentication method. See [Authentication](/development/webrtc/js-sdk/how-to/authenticating-your-app) for the full guide.

| Property          | Type     | Required               | Description                                                                                                                                                   |
| ----------------- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login_token`     | `string` | (if using JWT)         | JWT token for authentication. **Recommended for production.** Generate from your backend via `POST /v2/telephony_credentials/{id}/token`. Valid for 24 hours. |
| `login`           | `string` | (if using credentials) | SIP username (from Telephony Credential). **Development only.**                                                                                               |
| `password`        | `string` | (if using credentials) | SIP password. **Development only.**                                                                                                                           |
| `anonymous_login` | `object` | (if anonymous)         | Connect to an AI assistant without credentials. See [Anonymous Login](#anonymous-login).                                                                      |

<Callout type="warning">
  **Use `login_token` (JWT) for production applications.** Credentials (`login` + `password`) are long-lived with no automatic rotation. JWTs expire after 24 hours and support refresh. See [Authenticating Your App](/development/webrtc/js-sdk/how-to/authenticating-your-app).
</Callout>

**JWT (production):**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
});
```

**Credential (development only):**

```javascript theme={null}
const client = new TelnyxRTC({
 login: 'gencred...',
 password: 'your-password',
});
```

### Anonymous Login

Connect to an AI assistant without requiring a credential. The `anonymous_login` option accepts an object with the target configuration:

```javascript theme={null}
const client = new TelnyxRTC({
 anonymous_login: {
 target_type: 'ai_assistant', // Currently the only supported type
 target_id: 'YOUR_AI_ASSISTANT_ID', // The AI assistant to connect to
 },
});
```

| Property            | Type     | Required | Description                                                                                                                                                       |
| ------------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target_type`       | `string` |          | The target type. Currently only `'ai_assistant'` is supported.                                                                                                    |
| `target_id`         | `string` |          | The ID of the AI assistant to connect to.                                                                                                                         |
| `target_version_id` | `string` | —        | A specific version of the AI assistant.                                                                                                                           |
| `target_params`     | `object` | —        | Optional parameters forwarded to the assistant. Known key: `conversation_id` (string) to join an existing conversation. Additional keys are passed through as-is. |

**Example — Continue a conversation:**

```javascript theme={null}
const client = new TelnyxRTC({
 anonymous_login: {
 target_type: 'ai_assistant',
 target_id: 'asst_abc123',
 target_params: {
 conversation_id: 'conv_xyz789', // Resume existing conversation
 },
 },
});
```

***

## Connection

Control WebSocket, reconnection, and region behavior.

| Property                           | Type      | Default | Description                                                                                                                                                                                                         |
| ---------------------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `env`                              | `string`  | —       | Custom signaling server URL. Override `rtc.telnyx.com`. Only use for testing.                                                                                                                                       |
| `region`                           | `string`  | —       | Region to use for the connection.                                                                                                                                                                                   |
| `keepConnectionAliveOnSocketClose` | `boolean` | `false` | Keep PeerConnection alive during WebSocket reconnection. Call media continues flowing while signaling reconnects.                                                                                                   |
| `skipLastVoiceSdkId`               | `boolean` | `false` | When reconnecting with a stored `voice_sdk_id`, route to a different B2BUA-RTC instance instead of sticky-reconnecting to the same one. Useful when retrying after errors caused by stale state on a specific node. |
| `rtcIp`                            | `string`  | —       | Custom RTC connection IP address. Useful when using a custom signaling server.                                                                                                                                      |
| `rtcPort`                          | `number`  | —       | Custom RTC connection port. Useful when using a custom signaling server.                                                                                                                                            |
| `useCanaryRtcServer`               | `boolean` | `false` | Use Telnyx's canary RTC server.                                                                                                                                                                                     |

<Callout type="info">
  The SDK automatically reconnects when the WebSocket drops. There is no `reconnect` option — reconnection is always automatic.
</Callout>

**Enable call recovery:**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 keepConnectionAliveOnSocketClose: true,
});
```

***

## ICE & Network

Configure STUN/TURN and ICE behavior.

| Property                | Type             | Default          | Description                                                                                                  |
| ----------------------- | ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `iceServers`            | `RTCIceServer[]` | Auto-provisioned | Custom ICE servers. Overrides SDK defaults. Only use if you have custom TURN infrastructure.                 |
| `prefetchIceCandidates` | `boolean`        | `true`           | Pre-gather ICE candidates before the call is placed. Reduces call setup time.                                |
| `forceRelayCandidate`   | `boolean`        | `false`          | Force all media through TURN relay servers. Hides the client's public IP but adds latency.                   |
| `trickleIce`            | `boolean`        | —                | Enable Trickle ICE. Sends candidates incrementally instead of waiting for full gathering. Faster call setup. |
| `mutedMicOnStart`       | `boolean`        | —                | Start with microphone muted by default.                                                                      |

<Callout type="info">
  The SDK automatically provisions STUN/TURN servers. You don't need to configure `iceServers` in most cases. See [Network Requirements](/development/webrtc/js-sdk/how-to/configure-network-firewall).
</Callout>

**Force TURN for privacy:**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 forceRelayCandidate: true, // All media through TURN
});
```

**Custom ICE servers:**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 iceServers: [
 { urls: 'stun:stun.custom.com:3478' },
 {
 urls: 'turn:turn.custom.com:443?transport=udp',
 username: 'myuser',
 credential: 'mypass',
 },
 ],
});
```

***

## Audio

| Property       | Type     | Default | Description                                                                                                                             |
| -------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ringtoneFile` | `string` | —       | URL of a wav/mp3 file to play as the incoming call ringtone.                                                                            |
| `ringbackFile` | `string` | —       | URL of a wav/mp3 file to play as ringback tone. Use when you've disabled "Generate Ringback Tone" in your SIP Connection configuration. |

**Custom ringtone and ringback:**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 ringtoneFile: './sounds/incoming_call.mp3',
 ringbackFile: './sounds/ringback_tone.mp3',
});
```

***

## Call Reports

Enable post-call quality monitoring and real-time stats.

| Property             | Type      | Default | Description                                                                 |
| -------------------- | --------- | ------- | --------------------------------------------------------------------------- |
| `enableCallReports`  | `boolean` | `true`  | Enable call reports with WebRTC stats (RTT, jitter, packet loss, ICE data). |
| `callReportInterval` | `number`  | `5000`  | Interval in milliseconds between `telnyx.stats.frame` events during calls.  |

**Call reports are enabled by default.** You can customize the interval:

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 callReportInterval: 3000, // Stats every 3 seconds
});
```

**Listen for stats:**

```javascript theme={null}
client.on('telnyx.stats.frame', (stats) => {
 console.log('RTT:', stats.rtt, 'Jitter:', stats.jitter);
});

client.on('telnyx.stats.report', (report) => {
 console.log('Call ended. Final report:', report);
});
```

See [Monitor Call Quality](/development/webrtc/js-sdk/how-to/monitor-call-quality) for the full data schema.

***

## Debugging

Configure debug output for troubleshooting.

| Property      | Type                 | Default | Description                                                                                                                                       |
| ------------- | -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debug`       | `boolean`            | `false` | Enable debug logging. Outputs SDK internal logs to the browser console.                                                                           |
| `debugOutput` | `'socket' \| 'file'` | —       | Where to send debug output. `'socket'` sends to the debug visualizer at `https://webrtc-debug.telnyx.com/`. `'file'` writes debug data to a file. |

**Enable console debug logging:**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 debug: true,
});
```

**Send to debug visualizer:**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 debug: true,
 debugOutput: 'socket', // View at https://webrtc-debug.telnyx.com/
});
```

**Write debug data to a file:**

```javascript theme={null}
const client = new TelnyxRTC({
 login_token: jwt,
 debug: true,
 debugOutput: 'file',
});
```

See [Debug Call Issues](/development/webrtc/js-sdk/how-to/debug-call-issues) for interpreting debug output.

***

## Media Permissions Recovery

Handle microphone permission failures for inbound calls with a recoverable error pattern.

| Property                             | Type                     | Default | Description                                                                                      |
| ------------------------------------ | ------------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| `mediaPermissionsRecovery.enabled`   | `boolean`                | `false` | Enable the recovery flow.                                                                        |
| `mediaPermissionsRecovery.timeout`   | `number`                 | —       | Maximum time in ms to wait for the app to call `resume()` or `reject()`. Recommended max: 25000. |
| `mediaPermissionsRecovery.onSuccess` | `() => void`             | —       | Called when retry `getUserMedia` succeeds after `resume()`.                                      |
| `mediaPermissionsRecovery.onError`   | `(error: Error) => void` | —       | Called when retry fails, timeout expires, or app calls `reject()`.                               |

When enabled and `getUserMedia` fails while answering an inbound call, the SDK emits a recoverable `telnyx.error` event with `resume()` and `reject()` callbacks. Your app can prompt the user to fix permissions before the call fails:

```javascript theme={null}
import { TelnyxRTC, isMediaRecoveryErrorEvent } from '@telnyx/webrtc';

const client = new TelnyxRTC({
 login_token: jwt,
 mediaPermissionsRecovery: {
 enabled: true,
 timeout: 20000,
 onSuccess: () => console.log('Media recovered'),
 onError: (err) => console.error('Recovery failed', err),
 },
});

client.on('telnyx.error', (event) => {
 if (isMediaRecoveryErrorEvent(event)) {
 showPermissionDialog({
 onContinue: () => event.resume(),
 onCancel: () => event.reject?.(),
 });
 }
});
```

***

## Full Example

```javascript theme={null}
import { TelnyxRTC } from '@telnyx/webrtc';

const client = new TelnyxRTC({
 // Authentication
 login_token: 'YOUR_JWT_TOKEN',

 // Connection recovery
 keepConnectionAliveOnSocketClose: true,

 // Media recovery for inbound calls
 mediaPermissionsRecovery: {
 enabled: true,
 timeout: 20000,
 },

 // Call reports (enabled by default)
 callReportInterval: 5000,

 // ICE optimization
 prefetchIceCandidates: true,
 trickleIce: true,
});

client.on('telnyx.ready', () => {
 console.log('Connected');
});

client.on('telnyx.error', (error) => {
 console.error('Error:', error.code, error.message);
});

client.connect();
```

***

## See Also

* [TelnyxRTC Class](/development/webrtc/js-sdk/reference/telnyxrtc) — Client methods and events
* [Authenticating Your App](/development/webrtc/js-sdk/how-to/authenticating-your-app) — JWT, credentials, and token refresh
* [ICallOptions](/development/webrtc/js-sdk/reference/icalloptions) — Per-call configuration
* [Handle Reconnection](/development/webrtc/js-sdk/how-to/handle-reconnection) — Connection recovery
* [Network Requirements](/development/webrtc/js-sdk/how-to/configure-network-firewall) — STUN/TURN/firewall
* [Production Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices) — Production configuration guide
