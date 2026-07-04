---
title: "IP Whitelisting"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/network-configuration/ip-whitelisting.md"
category: "sip"
synced_at: "2026-06-25T18:43:19.937Z"
content_hash: "1b775f85912fc5a9d28f099ffe027c95e7af3fa909a137978fa096ad2f52a3bd"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# IP Whitelisting

> Whitelist your IP addresses on Telnyx SIP Trunking connections to authenticate calls without credentials. Includes allowed CIDR ranges, edge IPs, and AI services IPs.

Firewall and ACL configuration for Telnyx SIP signaling, media transport, webhook delivery, and AI services.

## SIP signaling and media

For current SIP signaling addresses, media IP ranges, supported codecs, and regional FQDNs, see [sip.telnyx.com](https://sip.telnyx.com).

## Port requirements

| Service             | Ports       | Protocol |
| ------------------- | ----------- | -------- |
| SIP signaling       | 5060        | UDP/TCP  |
| SIP signaling (TLS) | 5061        | TCP      |
| RTP media           | 16384-32768 | UDP      |
| Webhooks            | 443         | TCP      |

## Webhook IP addresses

Whitelist these CIDR blocks to receive webhook notifications.

### North America

| Region           | CIDR Block          |
| ---------------- | ------------------- |
| US-Central (CH1) | `192.76.120.128/29` |
| US-East (DC2)    | `192.76.120.136/29` |
| US-West (SV1)    | `192.76.120.144/29` |

### Europe

| Region          | CIDR Block         |
| --------------- | ------------------ |
| London (LD6)    | `185.246.41.0/29`  |
| Frankfurt (FR5) | `185.246.41.8/29`  |
| Amsterdam (AM6) | `185.246.41.16/29` |

### Asia-Pacific

| Region          | CIDR Block         |
| --------------- | ------------------ |
| Sydney (SY1)    | `103.115.244.0/29` |
| Singapore (SG1) | `103.115.244.8/29` |

These ranges also apply to WebSocket stream connections.

## AI Services IP addresses

Whitelist these CIDR blocks if you use Telnyx AI-powered voice services (AI Assistants, TeXML, Conversation Relay, or Call Control API). These are the source IPs from which Telnyx AI services emit webhook tool calls and HTTP callbacks. SIP signaling for AI workloads uses the same edge IPs as the rest of the platform (see [sip.telnyx.com](https://sip.telnyx.com)).

| CIDR Block       | Service                |
| ---------------- | ---------------------- |
| `64.16.239.0/24` | AI voice services (US) |
