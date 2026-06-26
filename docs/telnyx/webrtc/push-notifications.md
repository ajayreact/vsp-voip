---
title: "Overview"
source_url: "https://developers.telnyx.com/docs/voice/webrtc/push-notifications.md"
category: "webrtc"
synced_at: "2026-06-25T18:36:12.249Z"
content_hash: "697c45dd8736dff0a1c67047062439c5a4d64cf69edd1544b67da484876e3def"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Push Notifications Overview

> How push notifications work with Telnyx WebRTC SDKs to deliver incoming call alerts when your app is backgrounded or terminated.

## How push notifications work

When a client connects to the Telnyx WebRTC platform, it maintains a WebSocket connection that receives incoming call invitations in real time. If the app moves to the background or the device terminates it, that socket closes and calls can no longer reach the device.

Push notifications bridge this gap. During login the SDK registers a platform-specific push token (FCM for Android, APNS for iOS) with Telnyx. When an incoming call targets that user, Telnyx sends a push notification through the appropriate service. The device wakes the app, which reconnects to the socket and receives the actual call invitation.

```
Caller ──▶ Telnyx Platform ──▶ FCM / APNS ──▶ Device
                                                 │
                                          App wakes up
                                                 │
                                     Reconnects WebSocket
                                                 │
                                   Receives call invitation
```

## Multidevice support

A single user can register up to **5 push tokens** across iOS (APNS) and Android (FCM) devices. Each time a user logs in and provides a push token, Telnyx registers it. If a sixth token is added, the least-recently-used token is removed.

This means up to five devices can receive push notifications for the same incoming call simultaneously.

## Platform setup

Push notification configuration has two parts:

1. **Portal setup** — Create a push credential in the Telnyx Portal and attach it to a SIP Connection.
2. **App setup** — Integrate the push notification service into your application code and pass the token to the SDK on login.

Each platform has its own requirements:

| Platform     | Push service                           | Credential type                           | Guide                                                                    |
| ------------ | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Android      | Firebase Cloud Messaging (FCM)         | Android Credential (service account JSON) | [Android guide](/docs/voice/webrtc/push-notifications/android)           |
| iOS          | Apple Push Notification Service (APNS) | iOS Credential (cert.pem + key.pem)       | [iOS guide](/docs/voice/webrtc/push-notifications/ios)                   |
| Flutter      | FCM (Android) + APNS (iOS)             | Both credentials required                 | [Flutter guide](/docs/voice/webrtc/push-notifications/flutter)           |
| React Native | FCM (Android) + APNS (iOS)             | Both credentials required                 | [React Native guide](/docs/voice/webrtc/push-notifications/react-native) |

## API reference

You can also manage push credentials programmatically through the API:

* [Mobile Push Credentials API](/api/webrtc/mobile-push-credentials)
