---
title: "WebRTC Stats"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/stats.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:42:56.854Z"
content_hash: "6273484f9e4b7649b870cb605fd3cd0236fc4f32c206c4f0f575d6dde8f01dae"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC Stats

> WebRTC stats changelog for the Telnyx Flutter Voice SDK. Updates and improvements to call-quality metrics, packet stats, and diagnostic data exposed by the SDK.

## WebRTC Statistics

The SDK provides WebRTC statistics functionality to assist with troubleshooting and monitoring call quality. This feature is controlled through the `debug` flag in the `TxClient` configuration.

### Enabling WebRTC Statistics

To enable WebRTC statistics logging:

```dart theme={null}
final credentialConfig = CredentialConfig(
        sipUser: sipUser,
        sipPassword: sipPassword,
        sipCallerIDName: sipCallerIDName,
        sipCallerIDNumber: sipCallerIDNumber,
        notificationToken: await getNotificationTokenForPlatform() ?? '',
        debug: true, // Enable debug mode
      )

// or With Token Login

final  tokenConfig = TokenConfig(
   sipToken= sipToken ?: "",
   sipCallerIDName = this.callerIdName,
   sipCallerIDNumber = callerIdNumber,
   logLevel = LogLevel.ALL,
   debug = false
)
```

### Understanding WebRTC Statistics

When `debug: true` is configured:

* WebRTC statistics logs are automatically collected during calls
* Logs are sent to the Telnyx portal and are accessible in the Object Storage section
* Statistics are linked to the SIP credential used for testing
* The logs help the Telnyx support team diagnose issues and optimize call quality
* All statistics are presented in the Telnyx portal under the Object Storage section

### Real-time Call Quality Monitoring

The SDK provides real-time call quality metrics through the `onCallQualityChange` callback on the `Call` object. This allows you to monitor call quality in real-time and provide feedback to users.

#### Using onCallQualityChanged

```dart theme={null}
// When creating a new call set debug to true for CallQualityMetrics
val outgoingCall = telnyxClient.newInvite(callerName, callerNumber, destinationNumber, clientState, customHeaders, 
   debug // debug value
)
//When accepting a call
_currentCall = _telnyxClient.acceptCall(
   invite,
   _localName,
   _localNumber,
    debug: true, // Enable debug mode

);

// Set the onCallQualityChange callback
_currentCall = _telnyxClient.newInvite(
   _localName,
   _localNumber,
   destination,
  debug: true, // Enable debug mode
);

```

#### CallQualityMetrics Properties

The `CallQualityMetrics` object provides the following properties:

| Property              | Type                | Description                                                    |
| --------------------- | ------------------- | -------------------------------------------------------------- |
| `jitter`              | Double              | Jitter in seconds (multiply by 1000 for milliseconds)          |
| `rtt`                 | Double              | Round-trip time in seconds (multiply by 1000 for milliseconds) |
| `mos`                 | Double              | Mean Opinion Score (1.0-5.0)                                   |
| `quality`             | CallQuality         | Call quality rating based on MOS                               |
| `inboundAudio`        | `Map<String, Any>?` | Inbound audio statistics                                       |
| `outboundAudio`       | `Map<String, Any>?` | Outbound audio statistics                                      |
| `remoteInboundAudio`  | `Map<String, Any>?` | Remote inbound audio statistics                                |
| `remoteOutboundAudio` | `Map<String, Any>?` | Remote outbound audio statistics                               |

#### CallQuality Enum

The `CallQuality` enum provides the following values:

| Value        | MOS Range           | Description                 |
| ------------ | ------------------- | --------------------------- |
| `.excellent` | MOS > 4.2           | Excellent call quality      |
| `.good`      | 4.1 \<= MOS \<= 4.2 | Good call quality           |
| `.fair`      | 3.7 \<= MOS \<= 4.0 | Fair call quality           |
| `.poor`      | 3.1 \<= MOS \<= 3.6 | Poor call quality           |
| `.bad`       | MOS \<= 3.0         | Bad call quality            |
| `.unknown`   | N/A                 | Unable to calculate quality |

#### Best Practices for Call Quality Monitoring

1. **User Feedback**:
   * Consider showing a visual indicator of call quality to users
   * For poor quality calls, provide suggestions (e.g., "Try moving to an area with better connectivity")

2. **Logging**:
   * Log quality metrics for later analysis
   * Track quality trends over time to identify patterns

3. **Adaptive Behavior**:
   * Implement adaptive behaviors based on call quality
   * For example, suggest switching to audio-only if video quality is poor

4. **Performance Considerations**:
   * The callback is triggered periodically (approximately every 2 seconds)

### Important Notes

1. **Log Access**:
   * If you run the app using SIP credential A with `debug: true`, the WebRTC logs will be available in the Telnyx portal account associated with credential A
   * Logs are stored in the Object Storage section of your Telnyx portal

2. **Troubleshooting Support**:
   * WebRTC statistics are primarily intended to assist the Telnyx support team
   * When requesting support, enable `debug: true` in `TxClient` for all instances
   * Provide the `debug ID` or `callId` when contacting support
   * Statistics logging is disabled by default to optimize performance

3. **Best Practices**:
   * Enable `debug: true` only when troubleshooting is needed
   * Remember to provide the `debug ID` or `callId` in support requests
   * Consider disabling debug mode in production unless actively investigating issues

***
