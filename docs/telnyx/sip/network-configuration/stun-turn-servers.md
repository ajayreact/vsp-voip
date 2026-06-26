---
title: "STUN/TURN"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/network-configuration/stun-turn-servers.md"
category: "sip"
synced_at: "2026-06-25T18:43:20.420Z"
content_hash: "f37fff2ec7bd1ca5796deeac9937ae1c3ad6e281bb1f85a71a205f23b7a71f50"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# STUN/TURN Servers

> Connect WebRTC and NAT-traversed SIP clients to Telnyx using STUN and TURN servers. Includes hostnames, ports, and authentication for media relays.

STUN (Session Traversal Utilities for NAT) and TURN (Traversal Using Relays around NAT) servers enable NAT traversal for SIP clients behind firewalls and private networks.

## When to use STUN/TURN

Use STUN/TURN servers when the SIP client is:

* Behind a firewall or NAT gateway
* On a private network without public IP addresses
* Unable to receive inbound connections directly
* Experiencing one-way audio issues

## Telnyx STUN/TURN endpoints

Telnyx provides the following public endpoints for NAT traversal:

| Type | Endpoint          | Port | Protocol |
| ---- | ----------------- | ---- | -------- |
| STUN | `stun.telnyx.com` | 3478 | UDP      |
| TURN | `turn.telnyx.com` | 3478 | UDP/TCP  |

## Configuration

### Standard STUN configuration

Configure the SIP client to use Telnyx STUN servers for NAT traversal:

```text theme={null}
STUN Server: stun.telnyx.com:3478
```

### TURN with authentication

TURN requires credentials. Contact [Telnyx support](https://telnyx.com/support) to obtain TURN server credentials for the account.

```text theme={null}
TURN Server: turn.telnyx.com:3478
Username: [provided by Telnyx]
Password: [provided by Telnyx]
```

## Alternative STUN servers

While Telnyx provides its own STUN infrastructure, third-party STUN servers may also be used:

```text theme={null}
stun.l.google.com:19302
stun1.l.google.com:19302
stun2.l.google.com:19302
```

## Network requirements

Ensure the firewall allows outbound traffic:

| Service   | Port        | Protocol | Direction     |
| --------- | ----------- | -------- | ------------- |
| STUN      | 3478        | UDP      | Outbound      |
| TURN      | 3478        | UDP/TCP  | Outbound      |
| RTP media | 16384-32768 | UDP      | Bidirectional |

## ICE candidate types

When using STUN/TURN, the client will gather different types of ICE candidates:

* **host**: Local network addresses (cannot traverse NAT)
* **srflx**: Server reflexive addresses (via STUN)
* **relay**: Relayed addresses (via TURN)
* **prflx**: Peer reflexive addresses (discovered during connectivity checks)

For successful call establishment across NAT, at least one of the following candidate types must be available:

* `srflx` (server reflexive via STUN)
* `relay` (relayed via TURN)
* `prflx` (peer reflexive)

## Troubleshooting

### One-way audio

If one-way audio occurs:

1. Verify STUN server is reachable: `stun.telnyx.com:3478`
2. Check that UDP port 3478 is allowed outbound
3. Ensure RTP media ports (16384-32768) are open bidirectionally

### Connection failures

If calls fail to connect:

1. Verify firewall rules allow outbound UDP to port 3478
2. Check that the SIP client supports STUN/TURN
3. Confirm TURN credentials are correct (if using TURN)
4. Review ICE candidate gathering logs in the client

### Restrictive networks

In highly restrictive networks that block UDP traffic:

* Use TURN over TCP: `turn.telnyx.com:3478` (TCP)
* Consider using TLS for SIP signaling: port 5061
* Contact support for additional configuration options

## See also

* [IP Whitelisting](/docs/voice/sip-trunking/network-configuration/ip-whitelisting/index) - Firewall configuration for SIP signaling
* [WebRTC Troubleshooting](/docs/voice/webrtc/troubleshooting/interpreting-debug-data/index) - ICE candidate debugging
