---
title: "WebRTC Flutter Call State"
source_url: "https://developers.telnyx.com/development/webrtc/flutter-sdk/enums/call-state.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:41:43.842Z"
content_hash: "2ddca1893b97871a3141b458fb35a37179d301f3a34f134052e75a118d369a83"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# WebRTC Flutter Call State

> CallState enum reference for the Flutter Voice SDK. Represents the current state of a call (NEW, CONNECTING, RINGING, ACTIVE, DONE) and supported transitions.

# `CallState`

`CallState` represents the state of the call

```dart theme={null}
enum CallState {
  newCall,
  connecting,
  ringing,
  active,
  held,
  done,
  error,
}

```

## Cases

### `NEW`

```dart theme={null}
newCall
```

New call has been created in the client.

### `CONNECTING`

```dart theme={null}
connecting
```

The outbound call is being sent to the server.

### `RINGING`

```dart theme={null}
ringing
```

Call is pending to be answered. Someone is attempting to call you.

### `ACTIVE`

```dart theme={null}
active
```

Call is active when two clients are fully connected.

### `HELD`

```dart theme={null}
held
```

Call has been held.

### `DONE`

```dart theme={null}
done
```

Call has ended.

### `error`

```dart theme={null}
error
```

An error has occured
