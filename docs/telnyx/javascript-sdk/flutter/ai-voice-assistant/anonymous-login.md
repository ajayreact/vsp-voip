---
title: "WebRTC Flutter SDK AI Voice Assistant Anonymous Login"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/ai-voice-assistant/anonymous-login.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:42:55.572Z"
content_hash: "5c5e8d9aeff89fe6759bb5894ec648c920fabbc110617e51144d08fb7d6475f5"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC Flutter SDK AI Voice Assistant Anonymous Login

> Learn how to implement anonymous login for AI voice assistants with the Flutter Voice SDK

# Anonymous Login for AI Agents

## Overview

The `anonymousLogin` method allows you to connect to AI assistants without traditional authentication credentials. This is the first step in establishing communication with a Telnyx AI Agent.

## Method Signature

```dart theme={null}
Future<void> anonymousLogin({
  required String targetId,
  String targetType = 'ai_assistant',
  String? targetVersionId,
  Map<String, dynamic>? userVariables,
  bool reconnection = false,
  LogLevel logLevel = LogLevel.none,
})
```

## Parameters

| Parameter         | Type                    | Required | Default         | Description                                                             |
| ----------------- | ----------------------- | -------- | --------------- | ----------------------------------------------------------------------- |
| `targetId`        | String                  | Yes      | -               | The ID of your AI assistant                                             |
| `targetType`      | String                  | No       | 'ai\_assistant' | The type of target                                                      |
| `targetVersionId` | String?                 | No       | null            | Optional version ID of the target. If not provided, uses latest version |
| `userVariables`   | `Map<String, dynamic>?` | No       | null            | Optional user variables to include                                      |
| `reconnection`    | bool                    | No       | false           | Whether this is a reconnection attempt                                  |
| `logLevel`        | LogLevel                | No       | LogLevel.none   | Log level for this session                                              |

## Usage Example

```dart theme={null}
try {
  await _telnyxClient.anonymousLogin(
    targetId: 'your_assistant_id',
    // targetType: 'ai_assistant', // This is the default value
    // targetVersionId: 'your_assistant_version_id' // Optional
  );
  // You are now connected and can make a call to the AI Assistant.
} catch (e) {
  // Handle login error
  print('Login failed: $e');
}
```

## Advanced Usage

### With User Variables

```dart theme={null}
await _telnyxClient.anonymousLogin(
  targetId: 'your_assistant_id',
  userVariables: {
    'user_id': '12345',
    'session_context': 'support_chat',
    'language': 'en-US'
  }
);
```

### With Logging

```dart theme={null}
await _telnyxClient.anonymousLogin(
  targetId: 'your_assistant_id',
  logLevel: LogLevel.debug
);
```

## Important Notes

* **Call Routing**: After a successful `anonymousLogin`, any subsequent call, regardless of the destination, will be directed to the specified AI Assistant
* **Session Lock**: The session becomes locked to the AI assistant until disconnection
* **Version Control**: If `targetVersionId` is not provided, the SDK will use the latest available version
* **Error Handling**: Always wrap the call in a try-catch block to handle authentication errors

## Error Handling

Common errors you might encounter:

```dart theme={null}
try {
  await _telnyxClient.anonymousLogin(targetId: 'invalid_id');
} catch (e) {
  if (e.toString().contains('authentication')) {
    // Handle authentication error
    print('Invalid assistant ID or authentication failed');
  } else if (e.toString().contains('network')) {
    // Handle network error
    print('Network connection failed');
  } else {
    // Handle other errors
    print('Unexpected error: $e');
  }
}
```

## Next Steps

After successful anonymous login:

1. [Start a conversation](https://developers.telnyx.com/development/webrtc/flutter-sdk/ai-agent/starting-conversations) using `newInvite()`
2. [Set up transcript updates](https://developers.telnyx.com/development/webrtc/flutter-sdk/ai-agent/transcript-updates) to receive real-time conversation data
3. [Send text messages](https://developers.telnyx.com/development/webrtc/flutter-sdk/ai-agent/text-messaging) during active calls
