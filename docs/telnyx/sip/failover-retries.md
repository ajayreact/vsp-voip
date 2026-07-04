---
title: "Failover & Retries"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/routing/failover-and-retries.md"
category: "sip"
synced_at: "2026-06-25T18:30:49.342Z"
content_hash: "d3950516cbc3d6ebf081d29e5267f3dd86415c47cb00974bd70ddca261d96808"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Failover and Retries

> Configure failover and retry behavior on Telnyx SIP Trunking. Route calls to backup destinations on SIP failure codes for high availability.

Telnyx SIP connections automatically retry failed call attempts through different routes and IP addresses.

## Signaling IP addresses

Telnyx uses two geographically redundant signaling IPs per region:

| Region    | Primary (IP1)    | Secondary (IP2)  |
| --------- | ---------------- | ---------------- |
| US        | `192.76.120.10`  | `64.16.250.10`   |
| EU        | `5.172.39.10`    | `5.172.39.25`    |
| Canada    | `193.108.220.10` | `193.108.220.25` |
| Australia | `103.135.104.10` | `103.135.104.25` |

## Failover behavior

### Single route

1. SIP INVITE sent from IP1
2. On failure, retry from IP2

### Multiple routes

1. Attempt all routes via IP1 in configured order
2. On failure, retry all routes via IP2

Route order depends on configured preference (Sequential or Round Robin).

### Credential authentication

Calls route through the registered KSS instance with three levels of internal failover.

### Call forward on failure

When enabled, calls that fail on all SIP routes forward to PSTN (up to 10 termination carriers).

## Response codes

**Triggers failover:**

| Code            | Meaning                 |
| --------------- | ----------------------- |
| `408`           | Request Timeout         |
| `480`           | Temporarily Unavailable |
| `503`           | Service Unavailable     |
| `504`           | Server Timeout          |
| Transport error | Network/TCP failure     |

**Does NOT trigger failover** (call considered connected):

| Code  | Meaning       |
| ----- | ------------- |
| `180` | Ringing       |
| `200` | OK (answered) |
| `404` | Not Found     |
| `486` | Busy Here     |
| `603` | Decline       |

## DNS configuration

**SRV records (recommended):**

```
_sip._udp.example.com. 3600 IN SRV 10 10 5060 sip.telnyx.com.
```

Regional domains: `sip.telnyx.com` (US), `sip-eu.telnyx.com` (EU)

SRV records automatically resolve to both IP1 and IP2.

**A records (alternative):**

Configure separate A records for each signaling IP and add both as routes.

## Configuration

[PATCH /v2/ip\_connections/{id}](/api-reference/ip-connections/update-an-ip-connection):

```json theme={null}
{
  "default_routing_method": "sequential",
  "call_forwarding": {
    "forwarding_type": "on_failure"
  }
}
```
