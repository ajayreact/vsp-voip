---
title: "SIPREC Client"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/siprec-client.md"
category: "sip"
synced_at: "2026-06-25T18:43:03.917Z"
content_hash: "1929613e4a7ea18aa21f089ac0d8cf00800b9270dcff467dc21eb9c5910950fc"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Using SIPREC client for Voice API and TeXML calls

> Use the Telnyx SIPREC client to record Voice API and TeXML calls to an external SIPREC server. Includes session setup, metadata, and security options.

## What is a SIPREC client?

SIPREC client (SRC) is a component within the SIPREC framework. The SRC is responsible for initiating and managing the recording session, which communicates to the Session Recording Server (SRS) to send the media streams and metadata for recording.

## Creating a SIPREC server connector

To create an SIPREC recording session, you need to define an SIPREC server connector that will be used to establish a connection. It can be done using an API request as follows:

```bash theme={null}
curl --request POST \
  --url https://api.telnyx.com/v2/siprec_connectors \
  --header 'Authorization: Bearer XXX' \
  --header 'Content-Type: application/json' \
  --data '{
	"name": "siprec-server-connector",
	"host": "siprec.telnyx.com",
	"port": 5060
}'
```

## Creating a SIPREC recording session for Voice API calls

To start a SIPREC recording session you can use the following request:

```bash theme={null}
curl --request POST \
  --url https://api.telnyx.com/v2/{call_control_id}/actions/siprec_start \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer XXX' \
  --header 'Content-Type: application/json' \
  --data '{
        "connector_name": "siprec-server-connector",
        "direction": "both_tracks"
   }'

```

The session can be stopped at any point using the `siprec_stop` endpoint:

```bash theme={null}
curl --request POST \
  --url https://api.telnyx.com/v2/{call_control_id}/actions/siprec_stop \
  --header 'Accept: application/json' \
  --header 'Authorization: Bearer XXX' \
  --header 'Content-Type: application/json'
```

## Creating a SIPREC recording session for TeXML calls

To initialize the SIPREC recording session the following TeXML instruction can be used:

```xml theme={null}
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Siprec track="both_tracks" connectorName="siprec-server-connector" statusCallback="https://example.com/siprec_callback" />
  </Start>
</Response>
```

It can be stopped in the following way:

```xml theme={null}
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stop>
    <Siprec/>
  </Stop>
</Response>
```
