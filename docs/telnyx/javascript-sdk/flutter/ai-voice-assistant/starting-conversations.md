---
title: "WebRTC Flutter SDK AI Voice Assistant Starting Conversations"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/ai-voice-assistant/starting-conversations.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:42:56.090Z"
content_hash: "33821bf82bb9d4e22ce96f6fa87b0bc9949def5ac5fcd07b1a32e246b39242d5"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC Flutter SDK AI Voice Assistant Starting Conversations

> Learn how to start conversations with AI voice assistants using the Flutter Voice SDK

# Starting Conversations with AI Assistants

## Overview

After a successful `anonymousLogin`, you can initiate a call to your AI Assistant using the `newInvite` method. The AI assistant will automatically answer the call, and standard call controls will work normally.

## Method Usage

```dart theme={null}
Call newInvite(
  String callerName,
  String callerNumber,
  String destinationNumber,
  String clientState, {
  Map<String, String> customHeaders = const {},
  List<AudioCodec>? preferredCodecs,
  bool debug = false,
})
```

## Important Behavior

* **Destination Ignored**: Because the session is locked to the AI Assistant, the `destinationNumber` parameter is ignored, but can still be useful for referencing logs.
* **Automatic Answer**: The AI assistant automatically answers the call
* **Standard Controls**: All normal call controls (mute, hold, end, etc.) work as expected
* **Custom Headers**: You can pass custom SIP headers to provide context to the AI assistant. They will be mapped to [dynamic variables](https://developers.telnyx.com/docs/inference/ai-assistants/dynamic-variables) in the portal. Hyphens in header names are converted to underscores in variable names, e.g. `X-Session-Context` header maps to `{{session_context}}` variable.

## Basic Example

```dart theme={null}
// After a successful anonymousLogin...

Call aiCall = _telnyxClient.newInvite(
  'Your Name',
  'Your Number', 
  '', // Destination is ignored, can be an empty string
  'Your custom state',
);

// The call will be automatically answered by the AI Assistant
```

## Advanced Usage

### With Custom Headers

```dart theme={null}
Call aiCall = _telnyxClient.newInvite(
  'John Doe',
  '+1234567890',
  '', // Ignored
  'customer_support_session',
  customHeaders: {
    'X-Session-Context': 'billing_inquiry',
    'X-User-Tier': 'premium'
  }
);
```

Note: The above headers will map to dynamic variables `{{session_context}}` and `{{user_tier}}` in the AI assistant portal settings

### With Preferred Audio Codecs

```dart theme={null}
// Get supported codecs
List<AudioCodec> supportedCodecs = _telnyxClient.getSupportedAudioCodecs();

// Use preferred codecs (Opus for high quality)
Call aiCall = _telnyxClient.newInvite(
  'Jane Smith',
  '+1987654321',
  '',
  'technical_support',
  preferredCodecs: [
    AudioCodec(
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
      sdpFmtpLine: 'minptime=10;useinbandfec=1',
    ),
  ]
);
```

### With Debug Mode

```dart theme={null}
Call aiCall = _telnyxClient.newInvite(
  'Debug User',
  '+1555000123',
  '',
  'debug_session',
  debug: true // Enables call quality metrics
);

// Listen for call quality metrics
aiCall.onCallQualityChange = (metrics) {
  print('Call quality: ${metrics.quality}');
  print('MOS score: ${metrics.mos}');
};
```

## Call State Management

The AI call follows the same state management as regular calls:

```dart theme={null}
// Listen for call state changes
aiCall.callHandler.onCallStateChanged = (CallState state) {
  switch (state) {
    case CallState.connecting:
      print('Connecting to AI assistant...');
      break;
    case CallState.active:
      print('Connected to AI assistant');
      break;
    case CallState.done:
      print('AI conversation ended');
      break;
    // Handle other states...
  }
};
```

## Call Control Examples

### Mute/Unmute

```dart theme={null}
// Mute the microphone
aiCall.onMuteUnmutePressed();

// Check mute status
bool isMuted = aiCall.muted;
```

### Hold/Unhold

```dart theme={null}
// Put the call on hold
aiCall.onHoldUnholdPressed();

// Check hold status  
bool isOnHold = aiCall.held;
```

### Speaker Phone

```dart theme={null}
// Enable speaker phone
aiCall.enableSpeakerPhone(true);

// Disable speaker phone
aiCall.enableSpeakerPhone(false);
```

### End Call

```dart theme={null}
// End the AI conversation
aiCall.endCall();
```

## Error Handling

```dart theme={null}
try {
  Call aiCall = _telnyxClient.newInvite(
    'User Name',
    'User Number',
    '',
    'session_state'
  );
  
  // Set up error handling
  aiCall.callHandler.onCallStateChanged = (CallState state) {
    if (state == CallState.done) {
      // Check for call termination reason
      if (state.terminationReason?.cause == 'FAILED') {
        print('Call failed: ${state.terminationReason?.sipReason}');
      }
    }
  };
  
} catch (e) {
  print('Failed to start AI conversation: $e');
}
```

## Best Practices

1. **State Management**: Always set up call state listeners before initiating the call
2. **Error Handling**: Implement proper error handling for connection failures
3. **Resource Cleanup**: Ensure calls are properly ended to free resources
4. **User Feedback**: Provide clear UI feedback about connection status
5. **Debugging**: Use debug mode during development to monitor call quality

## Next Steps

After starting a conversation:

1. [Set up transcript updates](https://developers.telnyx.com/development/webrtc/flutter-sdk/ai-agent/transcript-updates) to receive real-time conversation data
2. [Send text messages](https://developers.telnyx.com/development/webrtc/flutter-sdk/ai-agent/text-messaging) during the active call
3. Use standard call controls as needed
