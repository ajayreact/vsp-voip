---
title: "External Transfers"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/features/external-transfers.md"
category: "transfers"
synced_at: "2026-06-25T18:43:21.150Z"
content_hash: "be3a8625df2797e8e3144b59c0a8a8687531133808f3d70ffb6ea951505e6a4f"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# External Call Transfers

> Use SIP REFER to transfer Telnyx SIP Trunking calls to external numbers. Configure your PBX or Voice API to hand off calls without bridging media.

External transfers move an inbound PSTN call to an external destination while preserving the original caller's identity.

## Call flow

1. Caller A dials Telnyx number B
2. Telnyx routes the call to the SIP endpoint (A → B)
3. The endpoint initiates a transfer to external number C
4. Telnyx places a new outbound call (A → C)

## Validation requirements

Telnyx validates external transfers to prevent unauthorized call spoofing:

* **Active call verification**: An active inbound call must exist from the original caller to the Telnyx number
* **Diversion header**: The outbound call leg must include a SIP `Diversion` header containing the Telnyx number

**Required Diversion header format:**

```
Diversion: <sip:+12125551234@sip.telnyx.com>
```

Transfers are rejected when no active call can be matched, the Diversion header is missing, or the header contains an unauthorized number.

## Transfer types

### Blind transfer

Immediate transfer without announcement:

```
REFER sip:+13035559876@sip.telnyx.com SIP/2.0
Refer-To: <sip:+13035559876@sip.telnyx.com>
```

### Attended transfer

1. Place the original call on hold
2. Dial the transfer destination
3. Announce the transfer
4. Complete with SIP REFER

## Programmable Voice implementation

### Transfer command

[POST /v2/calls/{call_control_id}/actions/transfer](/api-reference/call-commands/transfer-call):

```json theme={null}
{
  "to": "+13035559876",
  "from": "+12125551234"
}
```

### Dial with bridge

[POST /v2/calls](/api-reference/call-commands/dial) with `link_to` and `bridge_intent`:

```json theme={null}
{
  "connection_id": "1234567890",
  "to": "+13035559876",
  "from": "+12125551234",
  "link_to": "v3:abc123def456",
  "bridge_intent": true
}
```

### TeXML Dial

[\<Dial> verb](/docs/voice/programmable-voice/texml-verbs/dial):

```xml theme={null}
<Response>
  <Dial callerId="+12125551234">
    <Number>+13035559876</Number>
  </Dial>
</Response>
```

## Troubleshooting

If transfers fail, verify:

1. An active inbound call exists on the Telnyx number
2. The Diversion header includes the correct Telnyx number
3. The outbound voice profile allows calls to the destination
4. The destination number is in E.164 format
