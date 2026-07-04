---
title: "How ICE & TURN Work"
source_url: "https://developers.telnyx.com/development/webrtc/js-sdk/explanation/ice-and-turn.md"
category: "javascript-sdk"
synced_at: "2026-06-25T18:40:23.265Z"
content_hash: "665340d408c2e01d5df4e39b61f531a2bcdb83e07e785d4f96ba08f288fc1e54"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# How ICE & TURN Work

> How ICE connectivity checks, STUN, and TURN relay work in the Telnyx WebRTC JS SDK — and why they matter for call quality.

# How ICE & TURN Work

If you've ever wondered why some calls sound great and others don't, the answer is often in ICE — the protocol that finds the best path for media between two endpoints. Understanding ICE helps you diagnose one-way audio, connection failures, and latency issues.

***

## The Problem ICE Solves

Two devices want to send audio to each other. But between them:

* **NAT (Network Address Translation)** — Private IPs (192.168.x.x) aren't reachable from the internet
* **Firewalls** — Block incoming connections
* **Symmetric NAT** — Even STUN can't discover the public mapping

ICE (Interactive Connectivity Establishment) systematically tries every possible path and picks the best one.

***

## The Three Candidate Types

ICE discovers three types of candidates, in order of preference:

### 1. Host Candidates (Local)

Your device's local network interfaces (e.g., `192.168.1.105` on WiFi).

* **Works when:** Both devices are on the same LAN (rare for WebRTC calls)
* **Quality:** Best — zero extra latency
* **Reality:** Almost never used for WebRTC calls — both parties are rarely on the same network

### 2. Server-Reflexive Candidates (srflx) — via STUN

Your public IP, discovered by asking a STUN server (e.g., `203.0.113.5`).

**How STUN works:**

1. SDK sends a request to `stun.telnyx.com:3478`
2. STUN server sees the source IP (your public IP)
3. STUN server sends it back: "Your public IP is 203.0.113.5"
4. SDK creates a srflx candidate with that IP

* **Works when:** Your NAT allows inbound traffic to the mapped port (most home/office routers)
* **Quality:** Good — direct path, minimal extra latency
* **Blockers:** Symmetric NAT, strict firewalls

### 3. Relay Candidates — via TURN

An IP address allocated on a TURN server that relays your media (e.g., `64.16.248.1`).

**How TURN works:**

1. SDK authenticates with `turn.telnyx.com:3478` over UDP or TCP (TURN/TLS on 443 is not currently supported)
2. TURN server allocates a relay address (e.g., `64.16.248.1:50000`)
3. All media is sent TO the TURN server, which forwards it to the remote party
4. Remote party also sends TO the TURN server, which forwards to you

* **Works when:** Always — TURN is the fallback that never fails
* **Quality:** Adds latency (each packet goes through the TURN server) but guarantees connectivity
* **Required when:** Symmetric NAT, strict corporate firewalls, mobile carriers that block P2P

***

## ICE Candidate Priority

The SDK tries candidates in this priority order:

| Priority  | Type      | Path                     | Latency Impact         |
| --------- | --------- | ------------------------ | ---------------------- |
| 1 (best)  | **Host**  | Direct LAN               | None                   |
| 2         | **srflx** | Direct internet via STUN | Minimal                |
| 3 (worst) | **Relay** | Through TURN server      | +20-80ms per direction |

In practice, **most WebRTC calls use srflx (direct) or relay (TURN)**. Host candidates rarely work because both parties are on different networks.

<Callout type="info">
  **A common misconception:** "If my call uses TURN relay, something is wrong."

  **False.** TURN relay is normal and expected in many network conditions — mobile networks, corporate networks, some ISPs. The question isn't "is TURN being used?" but "is the TURN server close to me?"
</Callout>

***

## ICE Gathering Process

When a call starts, the SDK gathers candidates in this sequence:

| Time    | Event                                        | Result                                                                    |
| ------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| t=0ms   | SDK starts ICE gathering                     | Host candidates collected (e.g., `192.168.1.105` WiFi, `10.0.0.2` Docker) |
| \~50ms  | STUN request to `stun.telnyx.com:3478`       | srflx candidate discovered (e.g., `203.0.113.5:54321`)                    |
| \~100ms | TURN allocate to `turn.telnyx.com:3478`      | relay candidate allocated (e.g., `64.16.248.1:50000`)                     |
| \~200ms | SDP sent to remote party with all candidates | (or sent incrementally with Trickle ICE)                                  |

### Trickle ICE

By default, the SDK uses **Trickle ICE** — it sends candidates as they're discovered rather than waiting for all of them:

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: jwt,
  trickleIce: true, // default in SDK 2.25.20+
});
```

| Mode                    | Behavior                                                                                | Call setup impact |
| ----------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| **Without Trickle ICE** | SDK waits for ALL candidates (200-500ms) before sending INVITE                          | Slower setup      |
| **With Trickle ICE**    | SDK sends INVITE immediately with host candidates, then sends srflx/relay as discovered | 200-500ms faster  |

***

## ICE Connectivity Checks

Once both sides have candidates, ICE performs connectivity checks in this order:

| Step | Protocol           | Purpose                                  |
| ---- | ------------------ | ---------------------------------------- |
| 1    | **STUN Binding**   | Can I reach you? Can you reach me?       |
| 2    | **Nomination**     | This candidate pair works — let's use it |
| 3    | **DTLS handshake** | Encrypt the media path                   |
| 4    | **SRTP flows**     | Encrypted audio starts                   |

If the STUN check fails (e.g., firewall blocks it), ICE tries the next candidate pair until it finds one that works — falling back to TURN relay if necessary.

***

## DTLS — Encrypting Media

After ICE finds a working path, DTLS (Datagram Transport Layer Security) encrypts the media:

| Property     | Value                                      |
| ------------ | ------------------------------------------ |
| Protocol     | DTLS-SRTP (RFC 5764)                       |
| Cipher       | AES\_CM\_128\_HMAC\_SHA1\_80 (most common) |
| Key exchange | ECDHE (forward secrecy)                    |
| Fingerprint  | In SDP, verified during handshake          |

**DTLS states:**

| State        | Meaning                                           |
| ------------ | ------------------------------------------------- |
| `new`        | No handshake started                              |
| `connecting` | Handshake in progress                             |
| `connected`  | Keys exchanged, media encrypted                   |
| `failed`     | Handshake failed (often a network/firewall issue) |

<Callout type="warning">
  If DTLS is stuck at `connecting`, media won't flow even if ICE connected. This is the #1 cause of one-way audio.
</Callout>

***

## TURN Server Selection

Telnyx operates TURN servers in multiple regions:

| Region       | TURN Server               | IP Range    |
| ------------ | ------------------------- | ----------- |
| US East      | `turn-us-east.telnyx.com` | 64.16.248.x |
| US West      | `turn-us-west.telnyx.com` | 64.16.229.x |
| Europe       | `turn-eu.telnyx.com`      | 185.183.x.x |
| Asia-Pacific | `turn-apac.telnyx.com`    | (varies)    |

The SDK automatically selects the nearest TURN server. You can override:

```javascript theme={null}
const client = new TelnyxRTC({
  login_token: jwt,
  iceServers: [{
    urls: 'turn:turn-eu.telnyx.com:3478?transport=udp',
    username: '...',
    credential: '...',
  }],
});
```

### UDP vs TCP TURN

| Transport         | Port | Latency                  | When to Use         |
| ----------------- | ---- | ------------------------ | ------------------- |
| **UDP** (default) | 3478 | Lower                    | Most cases          |
| **TCP**           | 3478 | Higher (\~20-40ms extra) | When UDP is blocked |

The SDK tries UDP first, falls back to TCP automatically. TURN/TLS on port `443` is not currently supported.

***

## Troubleshooting ICE Issues

### STUN fails (error 701)

**Cause:** Firewall blocks `stun.telnyx.com:3478` (UDP)
**Result:** No srflx candidates — must use relay
**Fix:** Open UDP 3478 to STUN servers, or accept TURN relay

### All ICE fails

**Cause:** Both STUN and TURN are blocked
**Result:** Call cannot connect — no media path exists
**Fix:** Open access to TURN servers on port `3478` (UDP preferred, TCP fallback). TURN/TLS on port `443` is not currently supported.

### Relay when srflx should work

**Cause:** Symmetric NAT — NAT mapping changes per destination
**Result:** STUN-discovered port doesn't accept inbound from B2BUA-RTC
**Fix:** This is normal; TURN relay is the correct solution

### High latency on relay

**Cause:** TURN server is geographically distant
**Result:** 100ms+ added round-trip
**Fix:** Configure `iceServers` to use a closer TURN server

***

## See Also

* [Configure Network & Firewall](/development/webrtc/js-sdk/how-to/configure-network-firewall) — Firewall rules and IP allowlists
* [Debug Call Issues](/development/webrtc/js-sdk/how-to/debug-call-issues) — How to diagnose ICE/TURN problems
* [Monitor Call Quality](/development/webrtc/js-sdk/how-to/monitor-call-quality) — Check ICE stats in production
* [Call State Lifecycle](/development/webrtc/js-sdk/explanation/call-state-lifecycle)
* [How WebRTC Signaling Works](/development/webrtc/js-sdk/explanation/webrtc-signaling)
