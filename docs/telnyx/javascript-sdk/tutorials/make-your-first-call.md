---
title: "WebRTC JS SDK quickstart"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/tutorials/make-your-first-call.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:37:38.984Z"
content_hash: "31dc4e97ab164d786b65b1c38f33a3eda4d6bfbf2f22a6453983251b51386ae6"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC JS SDK quickstart

> Get started with the Telnyx WebRTC JS SDK in 5 minutes. Make and receive calls from your browser.

# Quickstart

Get the Telnyx WebRTC JS SDK running in your app — make your first call in under 5 minutes.

## Before You Begin

You'll need:

* A [Telnyx account](https://telnyx.com/sign-up)
* Node.js 16+ or a modern browser

### Portal Setup

Set up everything you need in the Telnyx Portal — no API calls required.

**1. Buy a number**

Go to **Numbers → Buy Numbers** in the Portal. Purchase a number in your desired country and area code.

**2. Create a Credential Connection**

Go to **Call Connections → Create → SIP Credential Connection**. This defines how your WebRTC client authenticates with the SIP network. Give it a name and keep the defaults.

**3. Create a Telephony Credential**

Go to **Call Connections → \[Your Connection] → Credentials → Create**. Each user (or device) needs its own credential. Note the **username** and **password** — you'll use these to generate a JWT.

**4. Assign your number to the connection**

Go to **Numbers → Your Numbers**, select your number, and assign it to the Credential Connection you created.

**5. Generate a JWT**

Still in the Credentials section, click **Generate Token** for the credential you created. Copy the JWT — this is what you'll pass to the SDK as `login_token`.

<Callout type="info">
  For production, generate JWTs from your backend using the API. See [Authenticating Your App](/development/webrtc/js-sdk/how-to/authenticating-your-app) for the full flow.
</Callout>

## Install

```bash theme={null}
npm install @telnyx/webrtc
```

## Create a Client

The SDK connects to Telnyx via WebSocket and establishes WebRTC media sessions. Here's the minimal setup:

```javascript theme={null}
import { TelnyxRTC } from '@telnyx/webrtc';

const client = new TelnyxRTC({
 login_token: 'YOUR_JWT_TOKEN', // Generate from your backend
});

client.on('telnyx.ready', () => {
 console.log(' Connected to Telnyx');
});

client.on('telnyx.error', (error) => {
 console.error(' Connection error:', error.code, error.message);
});

client.on('telnyx.notification', (notification) => {
 // Handle call updates (incoming calls, state changes)
 console.log('Notification:', notification.type);
});

client.connect();
```

<Callout type="warning">
  **Always wait for `telnyx.ready` before making calls.** The client needs to establish a WebSocket connection and authenticate before it can place calls.
</Callout>

## Authentication

The SDK supports three authentication methods:

| Method                | Property             | Use Case                       | Security                      |
| --------------------- | -------------------- | ------------------------------ | ----------------------------- |
| **JWT** (recommended) | `login_token`        | Production apps                | Token expires in 24h          |
| **Credential**        | `login` + `password` | Call Control apps, development | Long-lived, no rotation       |
| **Anonymous**         | `anonymous_login`    | AI assistant connections       | No identity, limited features |

**JWT (Production):**

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: 'eyJhbGciOi...', // From your backend
});
```

**Credential (Call Control):**

If you're using Telnyx Call Control, you can generate a SIP credential and use it directly:

```javascript theme={null}
const client = new TelnyxRTC({
  login: 'gencred...',     // SIP username from Portal
  password: 'your-password', // SIP password
});
```

Each user should get their own credential to avoid registration conflicts. JWT is still preferred for production — credentials don't expire and can't be rotated without updating the client.

**Anonymous (AI Assistants):**

```javascript theme={null}
const client = new TelnyxRTC({
  anonymous_login: {
    target_type: 'ai_assistant',
    target_id: 'YOUR_AI_ASSISTANT_ID',
  },
});
```

Anonymous login connects to an AI assistant without requiring a credential. Use this for click-to-call widgets that connect users directly to an AI agent.

<Callout type="info">
  For the full authentication guide including JWT generation, token refresh, and security best practices, see [Authenticating Your App](/development/webrtc/js-sdk/how-to/authenticating-your-app).
</Callout>

## Make an Outbound Call

```javascript theme={null}
client.on('telnyx.ready', () => {
 const call = client.newCall({
 destinationNumber: '+12345678900', // E.164 format
 audio: true,
 });

 // Listen for call state changes
 call.on('telnyx.notification', (notification) => {
 switch (notification.call.state) {
 case 'ringing':
 console.log(' Ringing...');
 break;
 case 'active':
 console.log(' Call connected!');
 break;
 case 'hangup':
 console.log(' Call ended');
 break;
 }
 });
});
```

## Receive an Inbound Call

```javascript theme={null}
client.on('telnyx.notification', (notification) => {
 if (notification.type === 'callUpdate') {
 const call = notification.call;

 if (call.state === 'ringing') {
 // Incoming call — answer it
 console.log(' Incoming call from', call.remotePartyNumber);
 call.answer();
 }
 }
});
```

<Callout type="info">
  For more control, show an "Accept/Reject" UI instead of auto-answering.
</Callout>

## Play Audio

The SDK handles audio elements automatically, but you can provide your own:

```javascript theme={null}
const call = client.newCall({
 destinationNumber: '+12345678900',
 audio: true,
 // Optional: provide audio elements for playback
 remoteElement: document.getElementById('remoteAudio'),
 localElement: document.getElementById('localAudio'),
});
```

Or let the SDK create them:

```html theme={null}
<!-- The SDK auto-creates audio elements and appends them to the body -->
<!-- Or provide specific elements: -->
<audio id="remoteAudio" autoplay></audio>
```

## Handle Errors

```javascript theme={null}
import { TELNYX_ERROR_CODES } from '@telnyx/webrtc';

client.on('telnyx.error', (error) => {
 switch (error.code) {
 case TELNYX_ERROR_CODES.WEBSOCKET_CONNECTION_FAILED:
 console.error('WebSocket failed — check network');
 break;
 case TELNYX_ERROR_CODES.ICE_CONNECTION_FAILED:
 console.error('ICE failed — check firewall/TURN config');
 break;
 default:
 console.error('Error:', error.code, error.message);
 }
});
```

See the full [Error Handling Guide](/development/webrtc/js-sdk/reference/sw-events) for all error codes and recommended responses.

## Disconnect

Always disconnect when the user leaves or the app unloads:

```javascript theme={null}
// User clicks "logout"
document.getElementById('logout').addEventListener('click', () => {
 client.disconnect();
});

// Page unload (tab close, navigation)
window.addEventListener('beforeunload', () => {
 client.disconnect();
});
```

## Next Steps

* **[Authentication](/development/webrtc/js-sdk/how-to/authenticating-your-app)** — JWT generation, token refresh, security best practices
* **[Call State Machine](/development/webrtc/js-sdk/explanation/call-state-lifecycle)** — Understanding call lifecycle and state transitions
* **[Call Options](/development/webrtc/js-sdk/reference/icalloptions)** — Custom headers, ICE config, media control
* **[Error Handling](/development/webrtc/js-sdk/reference/sw-events)** — Structured error codes and recovery
* **[Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices)** — Production checklist, performance, security
* **[Demo App](/development/webrtc/js-sdk/tutorials/make-your-first-call)** — Full working reference application

***

## Quick Reference

```javascript theme={null}
import { TelnyxRTC } from '@telnyx/webrtc';

// 1. Create client
const client = new TelnyxRTC({ login_token: 'YOUR_JWT' });

// 2. Listen for events
client.on('telnyx.ready', () => { /* Connected */ });
client.on('telnyx.error', (err) => { /* Handle errors */ });
client.on('telnyx.notification', (notif) => {
 if (notif.type === 'callUpdate' && notif.call.state === 'ringing') {
 notif.call.answer();
 }
});

// 3. Connect
client.connect();

// 4. Make a call
const call = client.newCall({ destinationNumber: '+12345678900' });

// 5. Call control
call.hangup(); // End call (async in 2.26+)
call.muteAudio(); // Mute microphone
call.unmuteAudio(); // Unmute

// 6. Disconnect
client.disconnect();
```
