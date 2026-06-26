---
title: "WebRTC Flutter Call"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/classes/call.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:41:20.268Z"
content_hash: "ae354c26aabbbf64ff350bc45b5facf5816ed563996499af1461f679506edc9e"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC Flutter Call

> Call class reference for the Telnyx Flutter Voice SDK. Represents an active audio or video call and exposes accept, decline, hold, mute, and DTMF methods.

### Call

The Call class is used to manage the call state and call actions. It is used to accept, decline, end, mute, hold, and send DTMF tones during a call.

### Accept Call

In order to accept a call, we simply retrieve the instance of the call and use the .acceptCall(callID) method:

```dart theme={null}
    _telnyxClient.call.acceptCall(_incomingInvite?.callID);
```

### Decline / End Call

In order to end a call, we can get a stored instance of Call and call the .endCall(callID) method. To decline an incoming call we first create the call with the .createCall() method and then call the .endCall(callID) method:

```dart theme={null}
    if (_ongoingCall) {
      _telnyxClient.call.endCall(_telnyxClient.call.callId);
    } else {
      _telnyxClient.createCall().endCall(_incomingInvite?.callID);
    }
```

### DTMF (Dual Tone Multi Frequency)

In order to send a DTMF message while on a call you can call the .dtmf(callID, tone), method where tone is a String value of the character you would like pressed:

```dart theme={null}
    _telnyxClient.call.dtmf(_telnyxClient.call.callId, tone);
```

### Mute a call

To mute a call, you can simply call the .onMuteUnmutePressed() method:

```dart theme={null}
    _telnyxClient.call.onMuteUnmutePressed();
```

### Toggle loud speaker

To toggle loud speaker, you can simply call .enableSpeakerPhone(bool):

```dart theme={null}
    _telnyxClient.call.enableSpeakerPhone(true);
```

### Put a call on hold

To put a call on hold, you can simply call the .onHoldUnholdPressed() method:

```dart theme={null}
    _telnyxClient.call.onHoldUnholdPressed();
```
