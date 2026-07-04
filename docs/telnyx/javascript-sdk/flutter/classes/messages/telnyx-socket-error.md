---
title: "Flutter WebRTC SDK Socket Error Message"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/classes/messages/telnyx-socket-error.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:41:37.069Z"
content_hash: "7e1fca7c9f798a76db8b7c7aed1f080aa37626e09c566979ccf8fe8a31084ae1"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Flutter WebRTC SDK Socket Error Message

> TelnyxSocketError reference for the Flutter Voice SDK. Represents an error received over the Telnyx WebSocket — codes, messages, and recovery patterns.

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
