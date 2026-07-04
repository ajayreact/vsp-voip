---
title: "Overview"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/authentication/credential-types.md"
category: "sip"
synced_at: "2026-06-25T18:29:18.261Z"
content_hash: "02b5b36472f1f288cebfa822664d5d77f42e2572632313faf1b62a5969f17c30"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# SIP Authentication Methods

> SIP authentication methods supported by Telnyx SIP Trunking — credential, IP, FQDN, and token authentication. Compare and choose the right method.

Telnyx SIP connections support multiple authentication methods based on network topology and security requirements.

## Methods

| Method                                                                        | Description                                | Details       |
| ----------------------------------------------------------------------------- | ------------------------------------------ | ------------- |
| Credential-based                                                              | Username/password for SIP registration     | See below     |
| [IP + Token](/docs/voice/sip-trunking/authentication/ip-authentication-token) | `X-Telnyx-Token` header with IP validation | Separate page |
| [IP + Tech Prefix](/docs/voice/sip-trunking/authentication/tech-prefix)       | 4-digit prefix prepended to dial string    | Separate page |
| IP + P-Charge-Info                                                            | Phone number in `P-Charge-Info` header     | See below     |
| FQDN                                                                          | Hostname-based inbound routing             | See below     |

## Credential-based authentication

Username and password for SIP registration.

[POST /v2/credential\_connections](/api-reference/credential-connections/create-a-credential-connection)

```json theme={null}
{
  "connection_name": "my-connection",
  "user_name": "username",
  "password": "secure-password"
}
```

For WebRTC applications requiring dynamic credentials or JWT tokens, see [WebRTC Authentication](/docs/voice/webrtc/auth/credential-connections).

## P-Charge-Info authentication

SIP header containing a phone number associated with the connection.

```
P-Charge-Info: <sip:+12125551234@sip.telnyx.com>
```

Requires E.164 format. The number must be assigned to the connection.

## FQDN authentication

Hostname-based inbound routing combined with credentials or IP authentication for outbound.

| Inbound | Outbound    |
| ------- | ----------- |
| FQDN    | Credentials |
| FQDN    | IP address  |

## Comparison

| Method             | Inbound | Outbound | Dynamic IP | Static IP |
| ------------------ | ------- | -------- | ---------- | --------- |
| Credentials        | ✓       | ✓        | ✓          | ✓         |
| IP + Tech prefix   | ✓       | ✓        | -          | ✓         |
| IP + Token         | ✓       | ✓        | -          | ✓         |
| IP + P-Charge-Info | ✓       | ✓        | -          | ✓         |
| FQDN + Credentials | ✓       | ✓        | ✓          | ✓         |
| FQDN + IP          | ✓       | ✓        | -          | ✓         |
