---
title: "Voice API Services in Europe"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/voice-api-services-in-europe.md"
category: "call-control"
synced_at: "2026-06-25T18:43:06.091Z"
content_hash: "a09e6f7bba110b249aa01e06c0c3443833ab48c785b7ef5b621fe6e1dbb7626b"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Voice API Services in Europe

> Telnyx Voice API services in Europe — use European points of presence to reduce latency and meet data residency requirements for EU-based voice apps.

## Overview

Telnyx now has a dedicated endpoint - [https://api.telnyx.eu](https://api.telnyx.eu), that can be used to help reduce the latency on calls held in Europe.

<Callout type="info">
  *Don't forget to update `YOUR_API_KEY` here.*
</Callout>

```bash theme={null}
curl --location --request POST 'https://api.telnyx.com/v2/calls' \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data-raw '{
    "to":"+18727726004",
    "from":"+18022455739",
    "connection_id":"1684641123236054244"
    }'
```

<Callout type="info">
  After pasting the above content, Kindly check and remove any new line added
</Callout>

To receive Voice API calls in Europe, Telnyx users should set the AnchorSite® for the application to one of the European Anchorsites—either Frankfurt, London or Amsterdam.

Users can change the AnchorSite® on any given application by editing their existing application and scrolling to the AnchorSite® Selection filed, as below:

<img src="https://mintcdn.com/telnyx/PAJh-h3FEJ6U1KdT/img/voice_programmable-voice_voice-api-services-in-europe_portal-voice-application-settings-anchorsite-selection.png?fit=max&auto=format&n=PAJh-h3FEJ6U1KdT&q=85&s=501259b705997d32923aef85a828306e" alt="Voice API services in Europe" width="2064" height="1060" data-path="img/voice_programmable-voice_voice-api-services-in-europe_portal-voice-application-settings-anchorsite-selection.png" />

> Please note that all the participants of the conferences and the calls to add to the queue must be in the same region.
