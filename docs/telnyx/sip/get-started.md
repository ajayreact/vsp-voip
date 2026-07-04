---
title: "Overview"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/get-started.md"
category: "sip"
synced_at: "2026-06-25T18:43:16.477Z"
content_hash: "5f34b0e8bfd7db7ab23173dd402b6e9eae29de16d735bc5e5acec06959491730"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# SIP Trunking Overview

> Overview of Telnyx SIP Trunking — buy numbers, create a SIP connection, configure authentication and routing, and place your first inbound/outbound call.

Telnyx SIP trunking uses **SIP Connections** for inbound traffic and authentication, and **Outbound Voice Profiles** for outbound call routing.

## SIP Connections

SIP connections authenticate traffic with Telnyx SIP proxies and configure inbound call handling.

| Component      | Description                                   |
| -------------- | --------------------------------------------- |
| Authentication | Credentials, IP address, or FQDN-based        |
| Anchorsite     | Regional PoP selection for media optimization |
| Phone numbers  | Assigned to connection for inbound routing    |

See [Authentication Methods](/docs/voice/sip-trunking/authentication/credential-types) for configuration details.

## Outbound Voice Profiles

Outbound voice profiles control outbound call routing, destinations, and spending limits.

| Component         | Description                              |
| ----------------- | ---------------------------------------- |
| SIP Connection    | Associated connection for outbound calls |
| Service plan      | Allowed destinations and rate limits     |
| Daily spend limit | Maximum daily spend cap                  |

## Network configuration

For SIP signaling addresses, media IP ranges, and port requirements, see [sip.telnyx.com](https://sip.telnyx.com).

## Related pages

* [Authentication Methods](/docs/voice/sip-trunking/authentication/credential-types)
* [IP Whitelisting](/docs/voice/sip-trunking/network-configuration/ip-whitelisting)
* [Routing Configuration](/docs/voice/sip-trunking/routing/failover-and-retries)
