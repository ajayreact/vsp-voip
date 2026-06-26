---
title: "WebRTC Flutter Client Push Notifications Configuration"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/method-objects/push-metadata.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:42:23.468Z"
content_hash: "3b36d7479b1f0713773c816798353a26c8e4ccc8cf2138165cfbac0476dcdf6e"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC Flutter Client Push Notifications Configuration

> PushMetadata reference for the Flutter Voice SDK. Properties carried in push notification payloads to wake the SDK and reconcile incoming calls.

### PushMetaData

This class is used to represent the metadata received from a push notification. It contains a `callerName`, `callerNumber`, `callId`, `voiceSdkId`, `isAnswer` and `isDecline` which are strings representing the metadata received from the push notification.

the `isAnswer` and `isDecline` are boolean values representing the state of the call.

the `callerName`, `callerNumber`, `callId`, `voiceSdkId` are strings representing information about the caller and SDK.

```dart theme={null}
class PushMetaData {
  PushMetaData({
    this.callerName,
    this.callerNumber,
    this.callId,
    this.voiceSdkId,
  });

  String? callerName;
  String? callerNumber;
  String? callId;
  String? voiceSdkId;
  bool? isAnswer;
  bool? isDecline;

  PushMetaData.fromJson(Map<dynamic, dynamic> json) {
    callerName = json['caller_name'];
    callerNumber = json['caller_number'];
    callId = json['call_id'];
    voiceSdkId = json['voice_sdk_id'];
    isAnswer = json['isAnswer'];
    isDecline = json['isDecline'];
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['caller_name'] = callerName;
    data['caller_number'] = callerNumber;
    data['call_id'] = callId;
    data['voice_sdk_id'] = voiceSdkId;
    data['isAnswer'] = isAnswer;
    data['isDecline'] = isDecline;
    return data;
  }
}
```
