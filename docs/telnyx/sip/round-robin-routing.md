---
title: "Round Robin Routing"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/routing/round-robin-routing.md"
category: "sip"
synced_at: "2026-06-25T18:30:24.593Z"
content_hash: "7eeea5a0dbfc1c359f5fc79555d1f64200376f0ded4c21544281fd43fa236f5f"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Round Robin Routing

> Distribute Telnyx SIP Trunking traffic evenly across multiple destinations using round-robin routing. Spread load between PBXes or geographic regions.

Round robin routing distributes inbound calls sequentially across all configured IP addresses in a SIP connection. Each IP receives equal call volume regardless of active call load.

## How it works

Calls route to IPs in sequential order:

```
Call 1 → IP 1
Call 2 → IP 2
Call 3 → IP 3
Call 4 → IP 1 (cycle repeats)
```

### Failover behavior

If the target IP fails, the system attempts remaining IPs in sequence. All IPs function as backups for each other.

Example: If IP 2 is selected first and fails, the system tries IP 3, then IP 1.

## Configuration

[PATCH /v2/ip\_connections/{id}](/api-reference/ip-connections/update-an-ip-connection)

```json theme={null}
{
  "default_routing_method": "round-robin"
}
```

## Limitations

* Only counts inbound call distribution, not active call load
* An IP handling 100 active calls receives the same incoming call rate as an IP handling 10 active calls

## Use cases

* Distributing load across multiple PBX instances
* High-availability setups without dedicated failover systems
* Deployments where simple call distribution is sufficient
