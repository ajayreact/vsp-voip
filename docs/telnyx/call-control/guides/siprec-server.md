---
title: "SIPREC Server Configuration"
source_url: "https://developers.telnyx.com/docs/voice/programmable-voice/siprec-server.md"
category: "sip"
synced_at: "2026-06-25T18:43:03.682Z"
content_hash: "7587c41dd5ec2d30f4c96e60e65a75806dfddd6f6181ba60072ed9f8a26cc99a"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Telnyx SIPREC server (SRS) Configuration Guide

> Configure a Telnyx SIPREC session recording server (SRS) to capture and store VoIP call media for compliance, quality assurance, and call archival.

## Introduction

SIPREC (Session Initiation Protocol Recording) is a standardized mechanism for recording VoIP calls. A SIPREC server, also known as a Session Recording Server (SRS), captures and stores these communications for compliance, quality assurance, and other purposes.

This guide provides instructions for setting up and configuring a SIPREC server using Telnyx's Voice API connection.

## Setting Up Your SIPREC Server Environment

### Step 1: Create a Voice API Application

1. Log to the [Telnyx portal](https://portal.telnyx.com).
2. Navigate to the Voice -> Programmable Voice -> Voice API section.
3. Create a new Voice API Application by clicking the "Add New Application" button.
4. Configure the application settings as required for your use case. Ensure that you provide a meaningful name and description for easy identification.

### Step 2: Assign an Inbound SIP Subdomain

1. Within your new Voice API Application, locate the section for Inbound Settings.
2. Assign an inbound SIP subdomain to your application. This subdomain will route incoming SIP traffic to your SIPREC server. Example subdomain format: `yourcompany.sip.telnyx.com`
3. Save the changes to apply the new configuration.

<img src="https://mintcdn.com/telnyx/piPv--L_2q5NFR4U/img/siprec_server_portal.png?fit=max&auto=format&n=piPv--L_2q5NFR4U&q=85&s=a986c466f98811433aa2e50f77cf2da7" alt="Configure siprec server connection" width="1111" height="1120" data-path="img/siprec_server_portal.png" />

### Step 3: Configuring the SIPREC Client (SRC)

With your Voice API Application and SIP subdomain set up, the next step is configuring your SIPREC Client (SRC) to interact with Telnyx SIPREC Server (SRS).

Please configure your SIPREC Client to use the following Session Recording Server URI:

```
sip:username@siprec.telnyx.com;secure=true
```

Where:

* **username**: any SIP username can be used, this information will be dropped
* **siprec.telnyx.com**: is the Telnyx SIPREC server (SRS) domain

***Note:*** The destination host header should send in the INVITE message as a custom header: `X-DestHost`

### Step 4: Configure SIPREC Token Authentication

SIPREC authentication tokens provide an additional layer of security for SIPREC calls directed to your subdomain application. By implementing these tokens, access to your subdomain voice application is restricted and controlled.

Tokens can be created via API by updating the connection settings. Use the following sample API call to create tokens:

```bash theme={null}
curl -X PATCH 'https://api.telnyx.com/v2/call_control_applications/:connection_id' \
-H 'content-type: application/json' -H 'authorization: Bearer <api-key>' \
--data-raw '{"siprec_tokens": ["test-token1", "test-token2"] }'
```

***NOTE:*** A maximum of two tokens can be configured per connection.

Once tokens are created, all SIPREC INVITEs sent to the subdomain application are authenticated. To enable authentication:

1. Add the token to the SIPREC INVITE request using the `X-Auth-Token` SIP header.
2. During the SIPREC call setup, the token provided in the `X-Auth-Token` header is verified against either of the two configured tokens.

Only verified tokens will allow the SIPREC call to proceed.

### Step 5: Initiating the SIPREC call

When the siprec session starts, two webhooks, one for each of the SIP calls of the media stream will be sent:

```json theme={null}
{
  "created_at": "2024-09-17T12:16:39.365600Z",
  "event_type": "call.initiated",
  "payload": {
    "call_control_id": "v3:ehsopsWMfki2clglbX0x4zeJoD1lV52zwLnw7rDJq_-kJoSnZcr0LQ",
    "call_leg_id": "b0f1c476-74ee-11ef-865a-02420aef3e20",
    "call_session_id": "b0f1c8fe-74ee-11ef-8704-02420aef3e20",
    "caller_id_name": "Outbound Call",
    "client_state": null,
    "connection_id": "1684641123236054244",
    "custom_headers": [
      {
        "name": "X-DestHost",
        "value": "yourcompany"
      },
      {
        "name": "X-Label",
        "value": "outbound"
      },
      {
        "name": "X-ParticipantID",
        "value": "F7yzLJtvXnTLaZflfmhkwpR5"
      },
      {
        "name": "X-SIPREC-SessionID",
        "value": "1772ce22-99ca-476a-b58f-1b848702e2ce"
      },
      {
        "name": "X-StreamID",
        "value": "QxjNUZblCzXqwKCTQpsm4Ok3"
      },
      {
        "name": "X-metadata-xml",
        "value": "PD94bWwgdmVyc2...."
      }
    ],
    "direction": "incoming",
    "from": "+48662211095",
    "occurred_at": "2024-09-17T12:16:39.123397Z",
    "offered_codecs": "PCMU,PCMA,G729",
    "start_time": "2024-09-17T12:16:39.123397Z",
    "state": "parked",
    "to": "+48662211095"
  },
  "record_type": "event",
  "webhook_id": "93415bbe-f7c3-4053-8b55-f4a1820d8dbf"
}
```

### Step 5: Recording the call

As the next step, the call can be answered and recording can be started using the following Voice API commands:

```bash theme={null}
curl -L 'https://api.telnyx.com/v2/calls/v3:ehsopsWMfki2clglbX0x4zeJoD1lV52zwLnw7rDJq_-kJoSnZcr0LQ/actions/answer' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer <TOKEN>' \
-d '{}'
```

```bash theme={null}
curl -L 'https://api.telnyx.com/v2/calls/v3:ehsopsWMfki2clglbX0x4zeJoD1lV52zwLnw7rDJq_-kJoSnZcr0LQ/actions/record_start' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer <TOKEN>' \
-d '{}'
```

## SIPREC call flow

By following this guide, you should have been able to successfully set up and configure your SIPREC client and server sides.

This is a typical SIPREC call flow:

<img src="https://mintcdn.com/telnyx/piPv--L_2q5NFR4U/img/siprec_call_flow.png?fit=max&auto=format&n=piPv--L_2q5NFR4U&q=85&s=5ecfa38288c9af3d0da2a28655137156" alt="SIPREC call flow" width="1124" height="953" data-path="img/siprec_call_flow.png" />

1. A call is established on the user’s SBC (which has SIPREC SRC capabilities) with RTP streams A and B
2. The SIPREC SRC initiates a SIPREC call towards the Telnyx SIPREC SRS (`siprec.telnyx.com`), with two RTP streams (A and B)
3. The Telnyx SRS initiates two SIP calls towards `sip.telnyx.com`, one for each RTP stream, and each one with `a:sendonly`, indicating that RTP is only sent and not received.
4. Telnyx sends two `call.initiated` webhooks to the Voice API application URL, one for each of the SIP calls, including the `call_control_id` and the metadata from the original SIPREC call (more on this in the next section).
5. The `call_control_id` is used to issue the Voice API commands to answer and record both calls.

## SIPREC metadata

Telnyx will pass the metadata that’s included by the SIPREC client on the original SIPREC INVITE message as custom SIP headers on the SIP calls, and each of these will trigger a webhook that contains all of the SIP custom headers.

Webhook variables with SIPREC metadata from the INVITE message received by the SIPREC SRS:

* to: the content of the SIP URI
* SIP Custom headers: any SIP custom headers will be included in the webhook
* SIPREC XML default metadata: These variables are extracted from the XML metadata and included in the webhook
  * DataMode
  * ParticipantID
  * NameID-AOR
  * Associate-Time
  * StreamID
  * Label
* SIPREC XML custom metadata: any custom variables will also be extracted from the XML metadata and included in the webhook
