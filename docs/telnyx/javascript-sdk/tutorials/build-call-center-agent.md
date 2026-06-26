---
title: "Build a Call Center Agent"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/tutorials/build-call-center-agent.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:37:49.431Z"
content_hash: "e1aeb8a906aa1cd5c88e09f521f0b011872ad9ba553f8c434d7eb8a760ec9da2"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Build a Call Center Agent

> Step-by-step tutorial for building a call center agent with the Telnyx WebRTC JS SDK — answering calls, muting, and holding.

# Build a Call Center Agent

This tutorial walks you through building a fully functional call center agent interface. You'll learn how to answer incoming calls, mute/unmute, and place calls on hold — the basics a real agent needs.

**Prerequisites:**

* Completed [Make Your First Call](/development/webrtc/js-sdk/tutorials/make-your-first-call)
* A Telnyx account with a Credential Connection and JWT set up
* A phone number routed to your Credential Connection

**What you'll build:** A browser-based agent dashboard that:

* Receives incoming calls
* Shows caller ID
* Supports mute and hold
* Tracks call duration
* Handles multiple calls with hold/resume

<Callout type="info">
  **This SDK is client-side only.** The WebRTC JS SDK handles real-time audio in the browser — it connects agents to calls, manages call state, and streams media. To route calls, create dial plans, or implement IVR logic, you need a backend application using:

  * **[Programmable Voice (Call Control)](/docs/v2/call-control)** — Build server-side call flows with the Telnyx API. Create calls, transfer, bridge, and play audio programmatically.
  * **[TeXML](/docs/voice/texml)** — Telnyx's markup language for voice applications. Define call flows in XML with verbs for dial, gather, play, say, and more.

  This tutorial assumes you already have a backend routing calls to your agents via one of these methods.
</Callout>

***

## Step 1: Set Up the HTML

Create `agent.html`:

```html theme={null}
<!DOCTYPE html>
<html>
<head>
 <title>Call Center Agent</title>
 <style>
 body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 0 20px; }
 .status { padding: 12px; border-radius: 8px; margin-bottom: 16px; }
 .status.connected { background: #d4edda; color: #155724; }
 .status.disconnected { background: #f8d7da; color: #721c24; }
 .call-card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
 .call-card.active { border-color: #28a745; background: #f0fff4; }
 .call-card.held { border-color: #ffc107; background: #fffdf0; }
 .call-card.ringing { border-color: #007bff; background: #f0f8ff; animation: pulse 1s infinite; }
 @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
 .controls { display: flex; gap: 8px; margin-top: 12px; }
 .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; }
 .btn-answer { background: #28a745; color: white; }
 .btn-reject { background: #dc3545; color: white; }
 .btn-mute { background: #6c757d; color: white; }
 .btn-hold { background: #ffc107; color: #333; }
 .btn-hangup { background: #dc3545; color: white; }
 .timer { font-size: 24px; font-weight: bold; font-variant-numeric: tabular-nums; }
 #incoming { display: none; }
 </style>
</head>
<body>
 <h1> Call Center Agent</h1>

 <div id="connection-status" class="status disconnected">Disconnected</div>

 <div id="incoming">
 <div class="call-card ringing">
 <h3 id="incoming-from">Unknown Caller</h3>
 <div class="controls">
 <button class="btn btn-answer" onclick="answerIncoming()">Answer</button>
 <button class="btn btn-reject" onclick="rejectIncoming()">Reject</button>
 </div>
 </div>
 </div>

 <div id="active-calls"></div>
</body>
</html>
```

***

## Step 2: Connect and Authenticate

Add a `<script>` tag and connect:

```html theme={null}
<script src="https://cdn.jsdelivr.net/npm/@telnyx/webrtc"></script>
<script>
 let client = null;
 let incomingCall = null;
 let activeCalls = new Map(); // callId → { call, timer, duration }
 let callTimers = new Map();

 async function connect() {
 // In production, fetch JWT from your backend
 const response = await fetch('/api/telnyx-token');
 const { token } = await response.json();

 client = new TelnyxRTC({
 login_token: token,
 enableCallReports: true,
 });

 // Wait for connection
 client.on('telnyx.ready', () => {
 document.getElementById('connection-status').className = 'status connected';
 document.getElementById('connection-status').textContent = 'Connected — Waiting for calls';
 });

 client.on('telnyx.socket.close', () => {
 document.getElementById('connection-status').className = 'status disconnected';
 document.getElementById('connection-status').textContent = 'Disconnected — Reconnecting...';
 });

 // Handle all notifications
 client.on('telnyx.notification', handleNotification);

 client.connect();
 }

 connect();
</script>
```

***

## Step 3: Handle Incoming Calls

```javascript theme={null}
function handleNotification(notification) {
 switch (notification.type) {
 case 'callUpdate':
 handleCallUpdate(notification.call);
 break;
 case 'userMediaError':
 alert('Microphone access denied. Please allow microphone access and try again.');
 break;
 }
}

function handleCallUpdate(call) {
 switch (call.state) {
 case 'ringing':
 if (call.direction === 'inbound') {
 incomingCall = call;
 document.getElementById('incoming-from').textContent =
 `Incoming call from: ${call.remotePartyNumber || 'Unknown'}`;
 document.getElementById('incoming').style.display = 'block';
 }
 break;

 case 'active':
 // Call is connected — add to active calls
 activeCalls.set(call.id, { call, startTime: Date.now() });
 startCallTimer(call.id);
 renderActiveCalls();
 break;

 case 'held':
 renderActiveCalls();
 break;

 case 'destroyed':
 stopCallTimer(call.id);
 activeCalls.delete(call.id);
 renderActiveCalls();
 break;
 }
}
```

***

## Step 4: Answer and Reject

```javascript theme={null}
function answerIncoming() {
 if (incomingCall) {
 incomingCall.answer();
 document.getElementById('incoming').style.display = 'none';
 incomingCall = null;
 }
}

function rejectIncoming() {
 if (incomingCall) {
 incomingCall.hangup();
 document.getElementById('incoming').style.display = 'none';
 incomingCall = null;
 }
}
```

***

## Step 5: Call Controls

```javascript theme={null}
function muteCall(callId) {
 const entry = activeCalls.get(callId);
 if (entry) {
 entry.call.mute();
 renderActiveCalls();
 }
}

function unmuteCall(callId) {
 const entry = activeCalls.get(callId);
 if (entry) {
 entry.call.unmute();
 renderActiveCalls();
 }
}

function holdCall(callId) {
 const entry = activeCalls.get(callId);
 if (entry) {
 entry.call.hold();
 }
}

function unholdCall(callId) {
 const entry = activeCalls.get(callId);
 if (entry) {
 entry.call.unhold();
 }
}

function hangupCall(callId) {
 const entry = activeCalls.get(callId);
 if (entry) {
 entry.call.hangup();
 }
}

```

***

## Step 6: Render the Active Calls UI

```javascript theme={null}
function renderActiveCalls() {
 const container = document.getElementById('active-calls');
 container.innerHTML = '';

 if (activeCalls.size === 0) {
 container.innerHTML = '<p>No active calls</p>';
 return;
 }

 activeCalls.forEach((entry, callId) => {
 const call = entry.call;
 const isMuted = call.isMuted; // Check mute state
 const isHeld = call.state === 'held';

 const card = document.createElement('div');
 card.className = `call-card ${call.state}`;
 card.innerHTML = `
 <div style="display: flex; justify-content: space-between; align-items: center;">
 <div>
 <strong>${call.remotePartyNumber || 'Unknown'}</strong>
 <span style="margin-left: 8px; color: #666;">${call.state}</span>
 ${isMuted ? '<span style="margin-left: 8px; color: #dc3545;"> Muted</span>' : ''}
 </div>
 <div class="timer" id="timer-${callId}">00:00</div>
 </div>
 <div class="controls">
 ${isMuted
 ? '<button class="btn btn-mute" onclick="unmuteCall(\'' + callId + '\')">Unmute</button>'
 : '<button class="btn btn-mute" onclick="muteCall(\'' + callId + '\')">Mute</button>'
 }
 ${isHeld
 ? '<button class="btn btn-hold" onclick="unholdCall(\'' + callId + '\')">Resume</button>'
 : '<button class="btn btn-hold" onclick="holdCall(\'' + callId + '\')">Hold</button>'
 }
 <button class="btn btn-hangup" onclick="hangupCall('${callId}')">Hang Up</button>
 </div>
 `;
 container.appendChild(card);
 });
}
```

***

## Step 7: Call Timer

```javascript theme={null}
function startCallTimer(callId) {
 const entry = activeCalls.get(callId);
 if (!entry) return;

 const startTime = entry.startTime;
 const timerElement = () => document.getElementById(`timer-${callId}`);

 callTimers.set(callId, setInterval(() => {
 const elapsed = Math.floor((Date.now() - startTime) / 1000);
 const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
 const seconds = String(elapsed % 60).padStart(2, '0');
 const el = timerElement();
 if (el) el.textContent = `${minutes}:${seconds}`;
 }, 1000));
}

function stopCallTimer(callId) {
 const timer = callTimers.get(callId);
 if (timer) {
 clearInterval(timer);
 callTimers.delete(callId);
 }
}
```

***

## Step 8: Cleanup

```javascript theme={null}
// Clean up when page closes
window.addEventListener('beforeunload', () => {
 if (client) {
 client.calls.forEach(call => call.hangup());
 client.disconnect();
 }
});
```

***

## What's Next?

You now have a working call center agent interface. Here are ways to extend it:

**Client-side (this SDK):**

| Feature                     | Guide                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Auto-answer incoming calls  | [ICallOptions](/development/webrtc/js-sdk/reference/icalloptions) — set `autoAnswer: true` |
| DTMF (press 1 for sales...) | `call.dtmf('1')` — See [Call Class](/development/webrtc/js-sdk/reference/call)             |
| Custom SIP headers          | [ICallOptions](/development/webrtc/js-sdk/reference/icalloptions) — `customHeaders`        |
| Call quality monitoring     | [Monitor Call Quality](/development/webrtc/js-sdk/how-to/monitor-call-quality)             |
| Reconnection handling       | [Handle Reconnection](/development/webrtc/js-sdk/how-to/handle-reconnection)               |
| React integration           | [Integrate with Frameworks](/development/webrtc/js-sdk/how-to/integrate-with-frameworks)   |
| Debug call issues           | [Debug Call Issues](/development/webrtc/js-sdk/how-to/debug-call-issues)                   |

**Server-side (backend):**

| Feature                    | Guide                                                          |
| -------------------------- | -------------------------------------------------------------- |
| Route calls to agents      | [Programmable Voice](/docs/v2/call-control) — Call Control API |
| Build IVR menus            | [TeXML](/docs/voice/texml) — `<Gather>`, `<Play>`, `<Say>`     |
| Transfer and bridge calls  | [Call Control Transfer](/docs/v2/calls/call-actions#transfer)  |
| Queue and distribute calls | [Call Control Queues](/docs/v2/call-control/queues)            |

***

## See Also

* [Make Your First Call](/development/webrtc/js-sdk/tutorials/make-your-first-call) — Basic tutorial
* [Programmable Voice](/docs/v2/call-control) — Server-side call management
* [TeXML](/docs/voice/texml) — XML-based voice applications
* [Production Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices) — Deployment guide
