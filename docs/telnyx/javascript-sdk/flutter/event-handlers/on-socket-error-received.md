---
title: "Flutter WebRTC SDK Socket Error Handler"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/event-handlers/on-socket-error-received.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:42:01.640Z"
content_hash: "9a8feff4fb2691873d561cb3f34effd0e53a38abb8268bbc79107aac30789664"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Flutter WebRTC SDK Socket Error Handler

> onSocketErrorReceived event handler for the Flutter Voice SDK. Callback invoked when errors are received from the Telnyx WebSocket connection.

### onSocketErrorReceived

The `onSocketErrorReceived` event handler is called when an error is received from the WebSocket connection.

```dart theme={null}
typedef OnSocketErrorReceived = void Function(TelnyxSocketError message);
```

### TelnyxSocketError

This class is used to represent an error received from the Telnyx Socket. It contains an `errorCode`
which is an integer representing the error code and an `errorMessage` which is a string representing
the error message.

```dart theme={null}
class TelnyxSocketError {
  int errorCode = 0;
  String errorMessage = '';

  TelnyxSocketError({required this.errorCode, required this.errorMessage});

  TelnyxSocketError.fromJson(Map<String, dynamic> json) {
    errorCode = json['code'] ?? 0;
    errorMessage = json['message'] ?? '';
  }
}
```

### Error Codes

The error code can be one of the following:

```dart theme={null}
class TelnyxErrorConstants {
  static const tokenError = 'Token registration error';
  static const tokenErrorCode = -32000;
  static const credentialError = 'Credential registration error';
  static const credentialErrorCode = -32001;
  static const gatewayTimeoutError = 'Gateway registration timeout';
  static const gatewayTimeoutErrorCode = -32003;
  static const gatewayFailedError = 'Gateway registration failed';
  static const gatewayFailedErrorCode = -32004;
  static const callNotFound = 'Call not found';
}
```
