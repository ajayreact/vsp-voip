---
title: "WebRTC JS SDK error handling"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/how-to/error-handling.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:39:01.492Z"
content_hash: "a95a4d41e9d7a4bc3ba00c3f54f74e4b6fc52fd0b90752bc23fe37f288a56fab"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC JS SDK error handling

> Handle errors, warnings, and connection failures with the Telnyx WebRTC JS SDK, including reconnection patterns, event-based recovery strategies, and version-specific guidance.

# Error Handling

The SDK exposes error-related behavior through three main channels:

| Event                 | Purpose                                                | Recommended use                                |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `telnyx.error`        | Fatal or blocking SDK errors                           | Show actionable errors, retry, re-authenticate |
| `telnyx.warning`      | Non-fatal quality, connectivity, and token warnings    | Show degraded-state UI, collect telemetry      |
| `telnyx.notification` | Call lifecycle updates and compatibility notifications | Drive call UI and hangup handling              |

Use `telnyx.ready` to know when the client is authenticated and the gateway is ready. Do not treat readiness as a notification case.

## What your application should react to

For production integrations, handle these events explicitly:

| Event                                           | React in UI?                    | Retry/recover yourself?          | Notes                                                                                          |
| ----------------------------------------------- | ------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `telnyx.ready`                                  | Yes                             | No                               | Connection is authenticated and ready for calls. Hide reconnecting state here.                 |
| `telnyx.error`                                  | Yes                             | Sometimes                        | Fatal/blocking errors. Follow the error code guidance below.                                   |
| `telnyx.warning`                                | Yes for call-affecting warnings | Usually no                       | Degraded but non-fatal. The SDK continues running and often starts automatic recovery.         |
| `telnyx.notification` with `type: 'callUpdate'` | Yes                             | No                               | Source of truth for call states, hangups, SIP cause/causeCode, and recovered calls.            |
| `telnyx.socket.close` / `telnyx.socket.error`   | Optional                        | No unless `autoReconnect: false` | Useful for telemetry and reconnecting UI; wait for `telnyx.ready` or `RECONNECTION_EXHAUSTED`. |

Do not treat every warning as a failed call. In the current SDK, media/signaling recovery warnings are intentionally emitted before the SDK attempts recovery, so your application can show a short degraded/reconnecting state while the SDK handles the recovery path.

> **Version note:** The structured error and warning system (`TELNYX_ERROR_CODES`, `telnyx.warning`, `TelnyxError`) was introduced after v2.25.25. If you are on v2.25.25, see the [Error handling in v2.25.25](#error-handling-in-v22525) section below.

***

## Structured Errors (`telnyx.error`)

`telnyx.error` is the primary error surface. Listen for it to handle authentication failures, media errors, and connection issues.

### Imports

```javascript theme={null}
import {
  SwEvent,
  TelnyxError,
  TELNYX_ERROR_CODES,
  isMediaRecoveryErrorEvent,
} from '@telnyx/webrtc';
```

### Basic example

```javascript theme={null}
client.on(SwEvent.Error, (event) => {
  if (isMediaRecoveryErrorEvent(event)) {
    openPermissionsDialog({
      deadline: event.retryDeadline,
      onRetry: () => event.resume(),
      onCancel: () => event.reject(),
    });
    return;
  }

  if (!(event.error instanceof TelnyxError)) {
    showErrorMessage('An unknown SDK error occurred.');
    return;
  }

  switch (event.error.code) {
    case TELNYX_ERROR_CODES.NETWORK_OFFLINE:
      showErrorMessage('You appear to be offline.');
      break;
    case TELNYX_ERROR_CODES.AUTHENTICATION_REQUIRED:
      showErrorMessage('Session expired. Please authenticate again.');
      break;
    default:
      showErrorMessage(event.error.message);
  }
});
```

### Media permission recovery

When `mediaPermissionsRecovery.enabled` is configured and `getUserMedia()` fails while answering a call, the error event includes `recoverable: true` with `resume()` and `reject()` callbacks:

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: jwt,
  mediaPermissionsRecovery: {
    enabled: true,
    timeout: 10000,
  },
});

client.on(SwEvent.Error, (event) => {
  if (isMediaRecoveryErrorEvent(event)) {
    // Show a dialog asking the user to grant microphone permission
    // event.retryDeadline is the timestamp by which they must act
    showPermissionDialog({
      onGrant: () => event.resume(),
      onDismiss: () => event.reject(),
    });
  }
});
```

***

## Error Code Reference

Each error below is classified as **fatal** or **recoverable** and includes guidance on what action you should take versus what the SDK handles automatically.

### SDP errors

| Code    | Name                                | Fatal? | Customer action                                         | SDK behavior                |
| ------- | ----------------------------------- | ------ | ------------------------------------------------------- | --------------------------- |
| `40001` | `SDP_CREATE_OFFER_FAILED`           | Fatal  | Show error to user; retry with `client.newCall()`       | Call is not established     |
| `40002` | `SDP_CREATE_ANSWER_FAILED`          | Fatal  | Show error to user; the inbound call cannot be answered | Call is rejected            |
| `40003` | `SDP_SET_LOCAL_DESCRIPTION_FAILED`  | Fatal  | Show error to user; retry the call                      | Call setup fails            |
| `40004` | `SDP_SET_REMOTE_DESCRIPTION_FAILED` | Fatal  | Show error to user; retry the call                      | Call setup fails            |
| `40005` | `SDP_SEND_FAILED`                   | Fatal  | Show error to user; retry the call                      | Signaling could not be sent |

### Media errors

| Code    | Name                                 | Fatal?                                             | Customer action                                                   | SDK behavior                                                                              |
| ------- | ------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `42001` | `MEDIA_MICROPHONE_PERMISSION_DENIED` | Fatal unless `mediaPermissionsRecovery` is enabled | Prompt user to grant microphone permission in browser/OS settings | Call fails; if `mediaPermissionsRecovery.enabled`, a recoverable error is emitted instead |
| `42002` | `MEDIA_DEVICE_NOT_FOUND`             | Fatal                                              | Check that a microphone is connected and the `deviceId` is valid  | Call fails                                                                                |
| `42003` | `MEDIA_GET_USER_MEDIA_FAILED`        | Fatal unless `mediaPermissionsRecovery` is enabled | Check browser permissions and device availability; retry          | Call fails; if `mediaPermissionsRecovery.enabled`, a recoverable error is emitted instead |

### Call-control errors

| Code    | Name                      | Fatal?             | Customer action                                 | SDK behavior                                                   |
| ------- | ------------------------- | ------------------ | ----------------------------------------------- | -------------------------------------------------------------- |
| `44001` | `HOLD_FAILED`             | Non-fatal per call | Retry hold operation                            | Hold is not applied                                            |
| `44002` | `INVALID_CALL_PARAMETERS` | Fatal              | Fix call parameters before retrying             | Call is not established                                        |
| `44003` | `BYE_SEND_FAILED`         | Non-fatal          | Call is still hung up locally; no action needed | Local hangup completes but BYE signal may not reach the server |
| `44004` | `SUBSCRIBE_FAILED`        | Fatal              | Check connection state; may need to reconnect   | Cannot subscribe to call events                                |
| `44005` | `PEER_CLOSED_DURING_INIT` | Fatal              | Retry the call                                  | Peer connection closed before call setup completed             |

### ICE restart errors

| Code    | Name                 | Fatal?             | Customer action                                                                        | SDK behavior                      |
| ------- | -------------------- | ------------------ | -------------------------------------------------------------------------------------- | --------------------------------- |
| `47001` | `ICE_RESTART_FAILED` | Fatal for the call | Show call failed/disconnected state; ask the user to retry the call or change networks | Media recovery could not complete |

### WebSocket and transport errors

| Code    | Name                          | Fatal?            | Customer action                                                                                                                                                                                              | SDK behavior                                                                                                                                    |
| ------- | ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `45001` | `WEBSOCKET_CONNECTION_FAILED` | Fatal for session | Check network connectivity; call `client.connect()` to retry                                                                                                                                                 | Session is not established                                                                                                                      |
| `45002` | `WEBSOCKET_ERROR`             | Fatal for session | Show reconnecting UI; SDK auto-reconnects by default (`autoReconnect` is enabled by default). If you disabled `autoReconnect`, call `client.connect()` manually. Wait for `telnyx.ready` to confirm recovery | WebSocket error occurred; SDK schedules `connect()` after a random 2-6 second delay when `autoReconnect` is not disabled                        |
| `45003` | `RECONNECTION_EXHAUSTED`      | Fatal for session | All automatic reconnect attempts exhausted. Call `client.disconnect()` then `client.connect()` to start a fresh connection, or recreate the client instance                                                  | Automatic reconnect stopped after `maxReconnectAttempts` attempts; default is 10 attempts, set `maxReconnectAttempts: 0` for unlimited attempts |
| `45004` | `GATEWAY_FAILED`              | Fatal for session | Show reconnecting UI; SDK auto-reconnects by default (`autoReconnect` is enabled by default). If you disabled `autoReconnect`, call `client.connect()` manually. Wait for `telnyx.ready` to confirm recovery | Gateway reported `FAILED` or `FAIL_WAIT`; SDK continues retrying when `autoReconnect` is not disabled                                           |

> **`autoReconnect` is enabled by default.** Unless you explicitly set `autoReconnect: false`, the SDK handles reconnection automatically for `WEBSOCKET_ERROR`, `GATEWAY_FAILED`, and signaling-health recovery. You only need to call `client.connect()` manually if you disabled `autoReconnect` or after `RECONNECTION_EXHAUSTED`.

### Authentication and session errors

| Code    | Name                      | Fatal?            | Customer action                                                                                            | SDK behavior                                                  |
| ------- | ------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `46001` | `LOGIN_FAILED`            | Fatal for session | Re-authenticate using `client.login()` without recreating the instance                                     | Registration never reached ready state                        |
| `46002` | `INVALID_CREDENTIALS`     | Fatal for session | Fix credential parameters; re-authenticate using `client.login()`                                          | Login was rejected before request was sent                    |
| `46003` | `AUTHENTICATION_REQUIRED` | Fatal for session | Re-authenticate using `client.login({ creds: { login_token: newToken } })` without recreating the instance | Request was sent before auth completed or after auth was lost |
| `48001` | `NETWORK_OFFLINE`         | Fatal for session | Restore network connectivity; SDK auto-reconnects when back online                                         | Browser `offline` event fired                                 |
| `49001` | `UNEXPECTED_ERROR`        | Fatal             | Check logs for details; retry the operation                                                                | Unclassified failure during peer/call setup                   |

> **Re-authenticate without recreating the instance.** For `LOGIN_FAILED` (`46001`), `INVALID_CREDENTIALS` (`46002`), and `AUTHENTICATION_REQUIRED` (`46003`), use `client.login()` to re-authenticate on the existing connection:
>
> ```javascript theme={null}
> // Refresh token without recreating TelnyxRTC
> await client.login({ creds: { login_token: newToken } });
> ```

***

## Structured Warnings (`telnyx.warning`)

Warnings are **never fatal**. They describe degraded behavior, quality issues, or situations that may need user action before the session breaks. The SDK continues operating after emitting a warning.

### Basic example

```javascript theme={null}
import { SwEvent, TELNYX_WARNING_CODES } from '@telnyx/webrtc';

client.on(SwEvent.Warning, ({ warning, callId }) => {
  if (warning.code === TELNYX_WARNING_CODES.TOKEN_EXPIRING_SOON) {
    refreshToken();
    return;
  }

  if (warning.code === TELNYX_WARNING_CODES.PEER_CONNECTION_FAILED) {
    showWarningBanner('Call is reconnecting');
    return;
  }

  console.warn(`[${warning.code}] ${warning.name}: ${warning.message}`);
});
```

### Warning event payload

Every warning event includes a structured `warning` object and the SDK `sessionId`. When a warning is associated with a specific call, `callId` is also included. Recovery-related warnings may include `reason` and `source` fields for diagnostics:

```javascript theme={null}
client.on(SwEvent.Warning, (event) => {
  const { warning, sessionId, callId, reason, source } = event;

  logSdkWarning({
    code: warning.code,
    name: warning.name,
    message: warning.message,
    causes: warning.causes,
    solutions: warning.solutions,
    sessionId,
    callId,
    reason,
    source,
  });
});
```

Use `warning.code` for application logic. Use `warning.message`, `warning.causes`, and `warning.solutions` for support tooling or user-facing troubleshooting copy.

### Warning code reference

#### Network quality warnings

| Code    | Name               | Auto-recovered?  | Customer action                                                                               |
| ------- | ------------------ | ---------------- | --------------------------------------------------------------------------------------------- |
| `31001` | `HIGH_RTT`         | May self-resolve | Show quality indicator; no immediate action needed                                            |
| `31002` | `HIGH_JITTER`      | May self-resolve | Show quality indicator; no immediate action needed                                            |
| `31003` | `HIGH_PACKET_LOSS` | May self-resolve | Show quality indicator; no immediate action needed                                            |
| `31004` | `LOW_MOS`          | May self-resolve | Show quality indicator; consider advising user                                                |
| `31005` | `LOW_LOCAL_AUDIO`  | May self-resolve | Show microphone-level indicator; ask the user to check mute/input gain or selected microphone |

#### Data-flow warnings

| Code    | Name                 | Auto-recovered?               | Customer action                                       |
| ------- | -------------------- | ----------------------------- | ----------------------------------------------------- |
| `32001` | `LOW_BYTES_RECEIVED` | May self-resolve on reconnect | Check remote party; show degraded audio indicator     |
| `32002` | `LOW_BYTES_SENT`     | May self-resolve on reconnect | Check local microphone; show degraded audio indicator |

#### Connectivity warnings

| Code    | Name                         | Auto-recovered?                           | Customer action                                                                                                                                                    |
| ------- | ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `33001` | `ICE_CONNECTIVITY_LOST`      | SDK attempts ICE reconnect                | Show reconnecting indicator; wait for recovery or `PEER_CONNECTION_FAILED`                                                                                         |
| `33002` | `ICE_GATHERING_TIMEOUT`      | May self-resolve                          | Check firewall/STUN/TURN config; show warning                                                                                                                      |
| `33003` | `ICE_GATHERING_EMPTY`        | No                                        | Check network/firewall settings; STUN/TURN may be blocked                                                                                                          |
| `33004` | `PEER_CONNECTION_FAILED`     | May recover — SDK may attempt ICE restart | Show reconnecting/degraded UI; wait for SDK recovery; only clean up after final hangup or call termination                                                         |
| `33005` | `ONLY_HOST_ICE_CANDIDATES`   | No                                        | Check STUN/TURN config; call may work on local network only                                                                                                        |
| `33006` | `ANSWER_WHILE_PEER_ACTIVE`   | No                                        | Ensure `answer()` is called only once per call; disable the answer button after the first click; check that `answer()` is not invoked from multiple event handlers |
| `33007` | `DUPLICATE_INBOUND_ANSWER`   | No                                        | Keep a single active `TelnyxRTC` instance for inbound calls; disconnect old clients before replacing them; answer only one duplicate inbound notification          |
| `33008` | `ICE_CANDIDATE_PAIR_CHANGED` | Usually yes                               | Log candidate path changes and monitor quality; frequent changes indicate unstable network, VPN, NAT rebinding, or relay fallback                                  |

#### Authentication and session warnings

| Code    | Name                     | Auto-recovered?     | Customer action                                             |
| ------- | ------------------------ | ------------------- | ----------------------------------------------------------- |
| `34001` | `TOKEN_EXPIRING_SOON`    | No, but preventable | Refresh the token before it expires; you have \~120 seconds |
| `35001` | `SESSION_NOT_REATTACHED` | No                  | Active calls were lost after reconnect; clean up call UI    |

#### Signaling health and recovery warnings

| Code    | Name                             | Auto-recovered?                                                                  | Customer action                                                                                              |
| ------- | -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `36001` | `SIGNALING_HEALTH_PROBE_TIMEOUT` | SDK force-closes the WebSocket and reconnects                                    | Show reconnecting/degraded UI; do not place a second call; wait for `telnyx.ready` and `callUpdate` recovery |
| `36002` | `SIGNALING_REQUEST_TIMEOUT`      | SDK force-closes the WebSocket and reconnects for critical call-control requests | Show reconnecting/degraded UI; collect `reason`/`source` for support                                         |
| `36003` | `SIGNALING_RECOVERY_REQUIRED`    | SDK reconnects signaling and reattaches active calls                             | Show short interruption state; wait for call reattach or final hangup                                        |
| `36004` | `MEDIA_RECOVERY_REQUIRED`        | SDK attempts ICE restart without reconnecting the socket                         | Show media reconnecting indicator; keep call UI active until recovery or final hangup                        |

Signaling health warnings are emitted when the SDK detects a half-dead WebSocket during an active call. This can happen when the browser still reports the socket as `OPEN`, but no signaling bytes are flowing after a network interface change, VPN change, NAT timeout, or proxy/load-balancer drop. The SDK decides one recovery path:

* If signaling is unhealthy, it reconnects the WebSocket and reattaches active calls.
* If signaling is healthy but media is unhealthy, it attempts ICE restart.
* It does not run both recovery paths at the same time.

Your application should keep the current call visible, show a reconnecting/degraded state, and wait for the next `callUpdate`, `telnyx.ready`, warning, or final `hangup` before cleaning up the UI.

***

## Call Termination Data

When a call reaches `hangup`, inspect these fields on the `Call` object:

| Field       | Type             | Meaning                                               |
| ----------- | ---------------- | ----------------------------------------------------- |
| `cause`     | `string \| null` | High-level cause (`USER_BUSY`, `CALL_REJECTED`, etc.) |
| `causeCode` | `number \| null` | Numeric cause code                                    |
| `sipCode`   | `number \| null` | SIP response code when available                      |
| `sipReason` | `string \| null` | SIP reason phrase when available                      |

Common causes:

| Cause                | Meaning                                    |
| -------------------- | ------------------------------------------ |
| `NORMAL_CLEARING`    | Expected call completion                   |
| `USER_BUSY`          | Remote party was busy                      |
| `CALL_REJECTED`      | Remote party rejected the call             |
| `NO_ANSWER`          | Call timed out unanswered                  |
| `UNALLOCATED_NUMBER` | Dialed number is invalid or does not exist |

***

## Socket Events

### `telnyx.socket.close`

Delivers the browser `CloseEvent`. During a forced safety cleanup, the SDK emits a synthetic abnormal close with `code: 1006` and `wasClean: false`.

Useful close codes:

| Code   | Meaning          |
| ------ | ---------------- |
| `1000` | Normal closure   |
| `1001` | Going away       |
| `1006` | Abnormal closure |
| `1011` | Internal error   |

### `telnyx.socket.error`

Delivers `{ error: ErrorEvent, sessionId: string }`. Browsers expose very little information for WebSocket errors. The SDK also emits `telnyx.error` with code `45002` (`WEBSOCKET_ERROR`) when `ws.onerror` fires.

***

## Connection State Helpers

The browser session exposes WebSocket state helpers on `client.connection`:

| Getter                        | Meaning                |
| ----------------------------- | ---------------------- |
| `client.connection.connected` | WebSocket is in `OPEN` |
| `client.connection.isAlive`   | `CONNECTING` or `OPEN` |
| `client.connection.isDead`    | `CLOSING` or `CLOSED`  |

Example:

```javascript theme={null}
const placeCall = (destinationNumber) => {
  if (!client.connection.connected) {
    showErrorMessage('Still connecting to Telnyx. Please try again shortly.');
    return;
  }

  client.newCall({ destinationNumber });
};
```

***

## Reconnection Behavior

On `telnyx.socket.close` or `telnyx.socket.error`, the SDK clears subscriptions and resets gateway readiness state. `autoReconnect` is enabled by default; unless you set `autoReconnect: false`, the SDK automatically schedules `connect()` after a randomized 2-6 second delay. Automatic reconnect stops after `maxReconnectAttempts` attempts (default: 10), or runs indefinitely when `maxReconnectAttempts: 0`.

### Gateway retry behavior

* **UNREGED / NOREG:** Up to 5 registration retries, each delayed 2-6 seconds randomly. After that, `LOGIN_FAILED` (`46001`).
* **FAILED / FAIL\_WAIT:** `GATEWAY_FAILED` (`45004`) emitted on first detection. Up to 5 retries with 2-6 second random delay before `RECONNECTION_EXHAUSTED` (`45003`).

### Keeping media alive

If `keepConnectionAliveOnSocketClose` is `true`, the SDK preserves active peer connections while signaling reconnects. Recovery can create a new `Call` object with `recoveredCallId`.

### Clearing reconnect stickiness

By default, the SDK reconnects to the same `b2bua-rtc` instance. To break this stickiness and route to a different instance:

```javascript theme={null}
// Before reconnecting
client.clearReconnectToken();

// Or configure the SDK to skip the last voice SDK ID on reconnect
const client = new TelnyxRTC({
  login_token: jwt,
  skipLastVoiceSdkId: true,
});
```

> **Note:** `clearReconnectToken()` and `skipLastVoiceSdkId` are available in `@telnyx/webrtc@2.26.4`.

***

## Error Handling in v2.25.25

> **Important:** If you are using SDK version `2.25.25`, the error handling architecture is fundamentally different from the current version. This section documents the v2.25.25 error surface.

### What is different in v2.25.25

| Feature                       | v2.25.25                                             | v2.26.0+                                                 |
| ----------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Structured error codes        | Not available                                        | `TELNYX_ERROR_CODES` with numeric codes                  |
| `telnyx.warning` event        | Not available                                        | Available with `TELNYX_WARNING_CODES`                    |
| `TelnyxError` class           | Not available                                        | Structured error class with `.code`, `.name`, `.message` |
| `isMediaRecoveryErrorEvent()` | Not available                                        | Available for media permission recovery                  |
| `SDK_ERRORS` / `SDK_WARNINGS` | Not available                                        | Available for error/warning metadata                     |
| Primary error surface         | `telnyx.error` (raw `Error`) + `telnyx.notification` | `telnyx.error` (structured) + `telnyx.warning`           |

### Error events in v2.25.25

In v2.25.25, errors are emitted through `telnyx.error` and `telnyx.notification`:

**`telnyx.error`** — Session-level errors with raw `Error` objects (no `.code` property):

```javascript theme={null}
client.on(SwEvent.Error, (event) => {
  // event.error is a plain Error object — no structured code
  // event.type may include ERROR_TYPE.invalidCredentialsOptions
  // event.sessionId is available
  console.error('SDK error:', event.error?.message || event.error);
});
```

**`telnyx.notification`** — Carries both call lifecycle updates **and** error information. This is the only recommended way to handle media, peer connection, and signaling errors in v2.25.25. Do not listen for `telnyx.rtc.mediaError`, `telnyx.rtc.peerConnectionFailureError`, or `telnyx.rtc.peerConnectionSignalingStateClosed` directly — those are internal events. Use `telnyx.notification` instead:

```javascript theme={null}
client.on(SwEvent.Notification, (notification) => {
  switch (notification.type) {
    case 'userMediaError':
      // notification.error — raw browser Error/DOMException
      // notification.errorName — error name string
      // notification.errorMessage — error message string
      // notification.call — the Call object (if available)
      // SDK automatically hangs up the call
      showPermissionPrompt(notification.errorMessage);
      break;

    case 'peerConnectionFailureError':
      // notification.error — raw error
      // Peer connection failed, but the call may be recovered by the server
      // via attach with 'recovering' state. Show degraded UI and wait.
      showReconnectingBanner();
      break;

    case 'signalingStateClosed':
      // Peer signaling state closed — peer is not recoverable
      // But the call may still recover through server attach
      // Only clean up after a final hangup/callUpdate confirms loss
      showReconnectingBanner();
      break;

    case 'callUpdate':
      // Normal call lifecycle
      handleCallUpdate(notification.call);
      break;
  }
});
```

Error-related notification types:

| `notification.type`          | Meaning                     | Fatal?                                                                     | Customer action                                                                                                                                                                      |
| ---------------------------- | --------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `userMediaError`             | Media device access failed  | Yes (for the call)                                                         | Prompt user for microphone permission; the SDK hangs up the call automatically                                                                                                       |
| `peerConnectionFailureError` | Peer connection failed      | Peer connection not recoverable, but call may be recovered                 | Show reconnecting/degraded UI; the call may be restored automatically by the server via attach with `recovering` state; only clean up after a final hangup/call update confirms loss |
| `signalingStateClosed`       | Peer signaling state closed | Peer connection not recoverable, but call may still be recovered by server | Show reconnecting/degraded UI; the call may recover through auto-created recovering call with the same `call_id`; only clean up after a final hangup/call update confirms loss       |

### Authentication errors in v2.25.25

Login errors are emitted on `telnyx.error` with a `type` field for invalid credentials. You can re-authenticate using `client.login()` without recreating the `TelnyxRTC` instance:

```javascript theme={null}
import { SwEvent, ERROR_TYPE } from '@telnyx/webrtc';

client.on(SwEvent.Error, (event) => {
  if (event.type === ERROR_TYPE.invalidCredentialsOptions) {
    // Credentials were invalid before the request was sent
    showLoginError('Please check your credentials.');
    return;
  }

  // For LOGIN_FAILED or AUTHENTICATION_REQUIRED, re-login without recreating the instance:
  // await client.login({ creds: { login_token: newToken } });

  // Other errors — generic handling
  showErrorMessage(event.error?.message || 'An error occurred');
});
```

### Reconnection in v2.25.25

Reconnection behavior is the same as the current version with these differences:

* `autoReconnect` is enabled by default; the SDK automatically reconnects unless you set `autoReconnect: false`
* No `maxReconnectAttempts` option (current SDK defaults to 10 automatic reconnect attempts and supports `maxReconnectAttempts: 0` for unlimited attempts)
* No `clearReconnectToken()` method
* No `skipLastVoiceSdkId` option
* `keepConnectionAliveOnSocketClose` is available

### Migrating from v2.25.25 to the latest

If you are upgrading from v2.25.25 to the latest version:

1. **Replace `telnyx.notification` error handling** — use `telnyx.error` for fatal errors and `telnyx.warning` for non-fatal conditions. Keep `telnyx.notification` for call lifecycle only.
2. **Replace `notification.type === 'userMediaError'` handling** with `telnyx.error` listener switching on `event.error.code` (`42001`, `42002`, `42003`).
3. **Replace `notification.type === 'peerConnectionFailureError'` handling** with `telnyx.warning` listener for `PEER_CONNECTION_FAILED` (`33004`).
4. **Replace `notification.type === 'signalingStateClosed'` handling** with `telnyx.warning` listener for the appropriate warning code.
5. **Replace `ERROR_TYPE.invalidCredentialsOptions` checks** with `event.error.code === TELNYX_ERROR_CODES.INVALID_CREDENTIALS` (`46002`). Use `client.login()` to re-authenticate without recreating the `TelnyxRTC` instance.
6. **Import new symbols:** `TelnyxError`, `TELNYX_ERROR_CODES`, `TELNYX_WARNING_CODES`, `isMediaRecoveryErrorEvent`.
7. **If you need media permission recovery for inbound calls**, enable `mediaPermissionsRecovery` and handle `isMediaRecoveryErrorEvent(event)`.
8. **Treat `telnyx.ready` as the only readiness signal.** The `vertoClientReady` notification type is no longer emitted on `telnyx.notification`.

The legacy RTC events (`telnyx.rtc.mediaError`, `telnyx.rtc.peerConnectionFailureError`, `telnyx.rtc.peerConnectionSignalingStateClosed`) are still emitted for backward compatibility but should not be used for new integrations.

***

## See Also

* [Call Class](/development/webrtc/js-sdk/reference/call) — Call control methods
* [Handle Reconnection](/development/webrtc/js-sdk/how-to/handle-reconnection) — Reconnection guide
* [Monitor Call Quality](/development/webrtc/js-sdk/how-to/monitor-call-quality) — Quality monitoring
* [Server Events](/development/webrtc/js-sdk/reference/sw-events) — Low-level signaling events
