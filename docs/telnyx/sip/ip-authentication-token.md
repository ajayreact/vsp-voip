---
title: "IP Authentication Token"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/authentication/ip-authentication-token.md"
category: "sip"
synced_at: "2026-06-25T18:29:31.397Z"
content_hash: "5e8d423564f203d1cd3bca60e313f239bbe20914dc15cd77ca97f965ad413015"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# IP Authentication Token

> Use IP authentication tokens on Telnyx SIP Trunking to authenticate calls without a fixed allowlist. Generate tokens and include them in SIP INVITEs.

The `X-Telnyx-Token` header distinguishes multiple SIP connections sharing the same IP address.

## Token requirements

| Requirement | Value                                         |
| ----------- | --------------------------------------------- |
| Characters  | Alphanumeric (a-z, A-Z, 0-9) and hyphens      |
| Length      | 12-48 characters                              |
| Scope       | Globally unique across all Telnyx connections |

## SIP header format

```
X-Telnyx-Token: your-token-value
```

Include this header in all outbound SIP INVITE requests.

## Configuration

[PATCH /v2/ip\_connections/{id}](/api-reference/ip-connections/update-an-ip-connection)

```json theme={null}
{
  "outbound": {
    "outbound_voice_profile_id": "uuid",
    "ip_authentication_token": "your-token-value"
  }
}
```

## Authentication behavior

| Condition                            | Result        |
| ------------------------------------ | ------------- |
| IP matches + token matches           | Authenticated |
| IP matches + token missing/incorrect | Rejected      |
| IP mismatch + token matches          | Rejected      |

Both the source IP and `X-Telnyx-Token` value must match the connection configuration.
