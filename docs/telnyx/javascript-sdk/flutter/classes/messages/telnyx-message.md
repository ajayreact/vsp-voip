---
title: "Flutter WebRTC SDK Message"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/classes/messages/telnyx-message.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:41:29.811Z"
content_hash: "cc47e63e45fc3cb7e3b3ad890d187825faa564f34c2bdc8d7ff94cc3b9911c70"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Flutter WebRTC SDK Message

> TelnyxMessage reference for the Flutter Voice SDK. Represents an inbound message received from the Telnyx socket — events, payload fields, and parsing.

### TelnyxMessage

This class is used to represent a message received from the Telnyx Socket. It contains a `socketMethod` which is a string representing the type of message received and a `ReceivedMessage` which contains the message data.

```dart theme={null}
class TelnyxMessage {
  String socketMethod;
  ReceivedMessage message;

  TelnyxMessage({required this.socketMethod, required this.message});
}
```

### Socket Methods

The socket method can be one of the following:

```dart theme={null}
class SocketMethod {
  static const answer = 'telnyx_rtc.answer';
  static const invite = 'telnyx_rtc.invite';
  static const bye = 'telnyx_rtc.bye';
  static const modify = 'telnyx_rtc.modify';
  static const media = 'telnyx_rtc.media';
  static const info = 'telnyx_rtc.info';
  static const ringing = 'telnyx_rtc.ringing';
  static const clientReady = 'telnyx_rtc.clientReady';
  static const gatewayState = 'telnyx_rtc.gatewayState';
  static const ping = 'telnyx_rtc.ping';
  static const login = 'login';
  static const attachCall = 'telnyx_rtc.attachCalls';
  static const attach = 'telnyx_rtc.attach';
}
```

### ReceivedMessage

The received message contains the data of the message received from the Telnyx Socket. It will contain the actual message as well as the state of the Call, client and SDK.
