---
title: "Device Management"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/how-to/switch-audio-devices.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:38:14.914Z"
content_hash: "486ec2d2f50d46543691f05c1bbf4f01648e82f12e7d8d59dd53a44de7cdbfa0"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Device Management

> How to select, switch, and manage audio input/output devices (microphones, speakers) with the Telnyx WebRTC JS SDK.

# Device Management

The Telnyx WebRTC JS SDK uses the browser's `MediaDevices` API for audio device management. This guide covers selecting devices, switching mid-call, and handling permission changes.

***

## Enumerate Devices

List available audio input and output devices:

```javascript theme={null}
const devices = await navigator.mediaDevices.enumerateDevices();

const microphones = devices.filter(d => d.kind === 'audioinput');
const speakers = devices.filter(d => d.kind === 'audiooutput');

microphones.forEach((mic, i) => {
  console.log(`Mic ${i}: ${mic.label} (${mic.deviceId})`);
});

speakers.forEach((speaker, i) => {
  console.log(`Speaker ${i}: ${speaker.label} (${speaker.deviceId})`);
});
```

<Callout type="info">
  Device labels are only available after the user grants microphone permission. Before permission, `label` is an empty string and `deviceId` is a placeholder.
</Callout>

***

## Request Permissions

Before you can select a specific device, the user must grant microphone access:

```javascript theme={null}
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // Permission granted — device labels now available
  stream.getTracks().forEach(track => track.stop()); // Release immediately
} catch (err) {
  if (err.name === 'NotAllowedError') {
    console.error('User denied microphone permission');
  } else if (err.name === 'NotFoundError') {
    console.error('No microphone found');
  }
}
```

***

## Select a Specific Device

### When placing a call

```javascript theme={null}
// Get the device ID first
const devices = await navigator.mediaDevices.getUserMedia({ audio: true });
const micDeviceId = devices.getAudioTracks()[0].getSettings().deviceId;
devices.getTracks().forEach(t => t.stop());

// Use it when placing the call
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  localStream: await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: micDeviceId },
    },
  }),
});
```

### Via ICallOptions constraints

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  // The SDK will request this specific device
});
```

***

## Switch Devices Mid-Call

Replace the audio track on an active PeerConnection:

```javascript theme={null}
async function switchMicrophone(newDeviceId) {
  if (!call?.peerConnection) return;

  // Get new stream with the selected device
  const newStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: newDeviceId },
    },
  });

  const newTrack = newStream.getAudioTracks()[0];
  const sender = call.peerConnection
    .getSenders()
    .find(s => s.track?.kind === 'audio');

  if (sender) {
    await sender.replaceTrack(newTrack);
    console.log('Switched to microphone:', newTrack.label);
  }
}
```

<Callout type="info">
  `replaceTrack()` doesn't require renegotiation — the switch is seamless. The remote party won't hear a gap.
</Callout>

***

## Speaker Output

Set the audio output device (sink) on the audio element:

```javascript theme={null}
const audioElement = document.getElementById('remoteAudio');

// Check if the browser supports sink selection
if (typeof audioElement.sinkId !== 'undefined') {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const speakers = devices.filter(d => d.kind === 'audiooutput');

  // Switch to a specific speaker
  await audioElement.setSinkId(speakers[1].deviceId);
}
```

<Callout type="warning">
  `setSinkId()` is not supported in all browsers. Safari does not support it as of 2026. Check `typeof audioElement.sinkId !== 'undefined'` before using.
</Callout>

***

## Device Change Detection

Listen for device changes (headphones plugged in, Bluetooth connected, etc.):

```javascript theme={null}
navigator.mediaDevices.addEventListener('devicechange', async () => {
  console.log('Audio devices changed');

  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter(d => d.kind === 'audioinput');

  // Update device picker UI
  updateMicrophoneList(mics);
});
```

**Common scenarios:**

* Headphones plugged in → switch output to headphones
* Bluetooth headset disconnected → fall back to built-in speaker
* USB microphone connected → update device list

***

## Mute vs Device Off

Don't confuse muting with device management:

| Action                       | What it does               | Remote party hears |
| ---------------------------- | -------------------------- | ------------------ |
| `call.muteAudio()`           | Stops sending audio        | Silence            |
| `track.enabled = false`      | Same as mute (lower level) | Silence            |
| Switching to a different mic | Changes input device       | New mic audio      |
| Revoking mic permission      | Browser blocks access      | Nothing            |

***

## Common Issues

### "Device not found" after permission grant

**Cause:** The device list was cached before permission was granted. Labels and real device IDs are only available after `getUserMedia()`.

**Fix:** Re-enumerate devices after permission is granted:

```javascript theme={null}
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
stream.getTracks().forEach(t => t.stop());

// Now enumerate — labels and real IDs are available
const devices = await navigator.mediaDevices.enumerateDevices();
```

### Echo or feedback

**Cause:** Speaker output is being picked up by the microphone (especially with built-in speakers + mic on laptops).

**Fix:**

1. Use echo cancellation (enabled by default in most browsers)
2. Recommend headphones for long calls
3. Use `call.muteAudio()` when not speaking

### Device disappears mid-call

**Cause:** Bluetooth disconnected, USB device unplugged.

**Fix:**

1. Listen for `devicechange` events
2. Fall back to the default device:
   ```javascript theme={null}
   navigator.mediaDevices.addEventListener('devicechange', async () => {
     const devices = await navigator.mediaDevices.enumerateDevices();
     const defaultMic = devices.find(d => d.kind === 'audioinput');
     if (defaultMic) {
       await switchMicrophone(defaultMic.deviceId);
     }
   });
   ```

***

## See Also

* [Call Class](/development/webrtc/js-sdk/classes/call) — `muteAudio()`, `unmuteAudio()`
* [ICallOptions](/development/webrtc/js-sdk/interfaces/icalloptions) — `localStream` for custom device selection
* [Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices) — Production deployment guide
