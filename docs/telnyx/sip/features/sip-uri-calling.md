---
title: "SIP URI Calling"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/features/sip-uri-calling.md"
category: "sip"
synced_at: "2026-06-25T18:43:21.394Z"
content_hash: "705f5850831bb133dc5effe9715274b5ae608da60704c7ed3450ddd69e68d31a"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# SIP URI Calling

> Place and receive SIP URI calls over Telnyx SIP Trunking. Dial endpoints by sip:user@domain instead of E.164 to connect VoIP systems directly.

SIP URI calling enables inbound calls to a SIP username, eliminating the need for a traditional phone number. This feature allows direct communication using SIP addresses in the format `username@sip.telnyx.com`.

## Prerequisites

* Active SIP connection with credential authentication
* SIP device or softphone registered with connection credentials
* Feature enabled on the connection's inbound settings

<Callout type="info">
  SIP URI calling is disabled by default and must be explicitly enabled for each connection.
</Callout>

## SIP URI format

Calls are placed to the SIP username using the standard SIP URI format:

```
username@sip.telnyx.com
```

**Username requirements:**

* Must begin with a non-numeric character
* This restriction prevents number spoofing and unauthorized dialing

Example valid usernames:

* `support@sip.telnyx.com`
* `pbx-main@sip.telnyx.com`
* `alice123@sip.telnyx.com`

Example invalid usernames:

* `123456@sip.telnyx.com` (starts with numeric character)

## Configuration

### Access control options

Configure SIP URI calling access using one of three modes:

| Mode         | Value          | Description                                                           | Use case                                                |
| ------------ | -------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| Disabled     | `disabled`     | Blocks all SIP URI calls                                              | Default security posture                                |
| Unrestricted | `unrestricted` | Allows calls from anyone on the internet                              | Public-facing services, customer support lines          |
| Internal     | `internal`     | Allows calls only from SIP connections within the same Telnyx account | Private inter-office communication, internal extensions |

### Configure via API

[PATCH /v2/ip\_connections/{id}](/api-reference/ip-connections/update-an-ip-connection) with the `sip_uri_calling_preference` parameter:

```json theme={null}
{
  "sip_uri_calling_preference": "unrestricted"
}
```

Set to `disabled`, `unrestricted`, or `internal` based on security requirements.

## Making SIP URI calls

### From Telnyx SIP connections

Dial directly to the SIP URI from any registered SIP endpoint:

```
INVITE sip:username@sip.telnyx.com SIP/2.0
```

### From external systems

When configured as `unrestricted`, external SIP systems can place calls:

```
INVITE sip:username@sip.telnyx.com SIP/2.0
From: <sip:caller@external-domain.com>
```

## Receiving SIP URI calls

Configure the SIP endpoint to accept incoming calls:

1. Register the SIP device using the connection credentials
2. Enable SIP URI calling with the appropriate access control
3. Configure the dial plan or routing rules to handle incoming calls

The call will arrive with the From header containing the caller's SIP URI or phone number.

## Billing

### Identifiable sources

Calls from Telnyx SIP connections use standard rate deck pricing based on the originating connection's pricing plan.

### Unidentifiable sources

When SIP URI calling is set to `unrestricted`, calls from external or unidentifiable sources are billed at **\$0.002/minute** to the connection owner.

<Callout type="warning">
  Monitor usage when enabling unrestricted access to prevent unexpected charges from public internet traffic.
</Callout>

## Security considerations

1. **Username validation**: Non-numeric username requirements prevent unauthorized number spoofing
2. **Access control**: Use `internal` mode for private communications within the organization
3. **Rate monitoring**: Track call volumes and sources when using `unrestricted` mode
4. **Authentication**: Credential-based connections provide secure endpoint registration

## Troubleshooting

If SIP URI calls fail, verify:

1. SIP URI calling is enabled on the connection
2. Username begins with a non-numeric character
3. Access control mode permits the calling source
4. SIP endpoint is properly registered with valid credentials
5. Firewall rules allow SIP traffic to/from Telnyx infrastructure
