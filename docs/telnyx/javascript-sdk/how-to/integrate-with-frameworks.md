---
title: "Framework Integration"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/how-to/integrate-with-frameworks.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:38:45.627Z"
content_hash: "52bf86170a8f6c2b409a2d167fc93091887243b6ac48c90be9d7e45055c3617a"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Framework Integration

> How to integrate the Telnyx WebRTC JS SDK with React, Next.js, Vue, and other JavaScript frameworks.

# Framework Integration

The Telnyx WebRTC JS SDK works with any JavaScript framework. This guide covers integration patterns for popular frameworks.

***

## React

### Install

```bash theme={null}
npm install @telnyx/webrtc @telnyx/react-client
```

### Using the React wrapper

The `@telnyx/react-client` package provides hooks and context providers:

```jsx theme={null}
import { TelnyxClientProvider, useCall, useTelnyxClient } from '@telnyx/react-client';

function App() {
  return (
    <TelnyxClientProvider>
      <CallScreen />
    </TelnyxClientProvider>
  );
}

function CallScreen() {
  const { client } = useTelnyxClient();
  const { call, makeCall, hangup } = useCall();

  return (
    <div>
      {call?.state === 'active' && <p>Call in progress</p>}
      <button onClick={() => makeCall('+12345678900')}>Call</button>
      {call && <button onClick={hangup}>Hang up</button>}
    </div>
  );
}
```

### Using the SDK directly

If you prefer to use the SDK without the React wrapper:

```jsx theme={null}
import { useEffect, useRef, useState } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';

function useTelnyxRTC(token) {
  const clientRef = useRef(null);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    const client = new TelnyxRTC({ login_token: token });

    client.on('telnyx.ready', () => {
      console.log('Connected');
    });

    client.on('telnyx.notification', (notification) => {
      if (notification.type === 'callUpdate') {
        setCalls([...client.calls]);
      }
    });

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [token]);

  return { client: clientRef.current, calls };
}
```

<Callout type="info">
  Always disconnect the client on component unmount to prevent zombie WebSocket connections.
</Callout>

***

## Next.js

Next.js requires special handling because the SDK uses browser APIs (`WebSocket`, `RTCPeerConnection`) that don't exist on the server.

### Dynamic import

```jsx theme={null}
import dynamic from 'next/dynamic';

const CallScreen = dynamic(() => import('../components/CallScreen'), {
  ssr: false,  // Required — SDK uses browser APIs
});

export default function Page() {
  return <CallScreen />;
}
```

### Client component (App Router)

```jsx theme={null}
'use client';

import { useEffect, useState } from 'react';

export default function CallScreen() {
  const [client, setClient] = useState(null);

  useEffect(() => {
    // Dynamic import to avoid SSR
    import('@telnyx/webrtc').then(({ TelnyxRTC }) => {
      const rtc = new TelnyxRTC({ login_token: getToken() });
      rtc.connect();
      setClient(rtc);
    });

    return () => {
      client?.disconnect();
    };
  }, []);

  return <div>Call UI here</div>;
}
```

***

## Vue

### Composable

```javascript theme={null}
// composables/useTelnyx.js
import { ref, onUnmounted } from 'vue';
import { TelnyxRTC } from '@telnyx/webrtc';

export function useTelnyx(token) {
  const client = ref(null);
  const calls = ref([]);
  const connected = ref(false);

  function connect() {
    const rtc = new TelnyxRTC({ login_token: token });

    rtc.on('telnyx.ready', () => {
      connected.value = true;
    });

    rtc.on('telnyx.notification', (notification) => {
      if (notification.type === 'callUpdate') {
        calls.value = [...rtc.calls];
      }
    });

    rtc.connect();
    client.value = rtc;
  }

  function disconnect() {
    client.value?.disconnect();
    connected.value = false;
  }

  onUnmounted(() => {
    disconnect();
  });

  return { client, calls, connected, connect, disconnect };
}
```

### Component

```vue theme={null}
<template>
  <div>
    <button @click="makeCall">Call</button>
    <button @click="disconnect" v-if="connected">Disconnect</button>
  </div>
</template>

<script setup>
import { useTelnyx } from '../composables/useTelnyx';

const { client, calls, connected, connect, disconnect } = useTelnyx(token);

function makeCall() {
  client.value?.newCall({
    destinationNumber: '+12345678900',
    audio: true,
  });
}

connect();
</script>
```

***

## Angular

### Service

```typescript theme={null}
import { Injectable, OnDestroy } from '@angular/core';
import { TelnyxRTC } from '@telnyx/webrtc';

@Injectable({ providedIn: 'root' })
export class TelnyxService implements OnDestroy {
  private client: TelnyxRTC | null = null;

  connect(token: string) {
    this.client = new TelnyxRTC({ login_token: token });

    this.client.on('telnyx.ready', () => {
      console.log('Connected');
    });

    this.client.on('telnyx.notification', (notification) => {
      // Handle notifications
    });

    this.client.connect();
  }

  makeCall(destination: string) {
    return this.client?.newCall({
      destinationNumber: destination,
      audio: true,
    });
  }

  disconnect() {
    this.client?.disconnect();
    this.client = null;
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
```

***

## General Patterns

### Token fetching

All frameworks should fetch JWT tokens from a backend endpoint:

```javascript theme={null}
// Don't hardcode tokens
const token = await fetch('/api/telnyx-token').then(r => r.text());
```

### Audio element management

The SDK auto-creates audio elements, but in some frameworks you may want to manage them yourself:

```javascript theme={null}
const call = client.newCall({
  destinationNumber: '+12345678900',
  audio: true,
  remoteElement: document.getElementById('remoteAudio'),
  localElement: document.getElementById('localAudio'),
});
```

Or after the call is active:

```javascript theme={null}
// The SDK appends audio elements to document.body by default
// You can move them:
const audioEl = document.querySelector('audio[src^="blob:"]');
if (audioEl) {
  document.getElementById('audioContainer').appendChild(audioEl);
}
```

### Cleanup

Always clean up on unmount/unload:

```javascript theme={null}
// React
useEffect(() => {
  return () => client?.disconnect();
}, []);

// Vue
onUnmounted(() => client?.disconnect());

// Angular
ngOnDestroy() { this.client?.disconnect(); }

// Vanilla
window.addEventListener('beforeunload', () => client?.disconnect());
```

***

## See Also

* [Quickstart](/development/webrtc/js-sdk/quickstart) — Get started in 5 minutes
* [Authentication](/development/webrtc/js-sdk/how-to/authenticating-your-app) — JWT setup for production
* [IClientOptions](/development/webrtc/js-sdk/interfaces/iclientoptions) — Client configuration
* [Best Practices](/development/webrtc/js-sdk/how-to/production-best-practices) — Production deployment guide
* [Demo App](https://github.com/team-telnyx/webrtc-demo-js) — Full React reference application
