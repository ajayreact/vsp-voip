---
title: "Outbound Voice Profiles for SIP trunking"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/configuration/outbound-voice-profiles.md"
category: "sip"
synced_at: "2026-06-25T18:43:18.486Z"
content_hash: "ce1306536dc72628febb51d84e6e4c64f784e12f6a1152f94e359a4244ea2ed6"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Outbound Voice Profiles for SIP trunking

> Attach Outbound Voice Profiles to Telnyx SIP Trunking connections to control allowed destinations, rate limits, daily spend, and outbound routing.

Outbound voice profiles control routing, billing, and rate limits for outbound SIP calls. Each profile generates a unique Profile ID used in API calls and CDR reports.

## Profile components

| Component       | Description                                          |
| --------------- | ---------------------------------------------------- |
| Profile ID      | Unique identifier for API calls and billing reports  |
| Tags            | Custom labels for tracking and cost allocation       |
| SIP Connections | Associated connections authorized for outbound calls |
| Service Plan    | Allowed destinations and rate deck configuration     |
| Channel Limit   | Maximum concurrent outbound channels per profile     |

## Destinations

Telnyx supports 255 destinations across 10 regions. Enable destinations by region or individual country.

<Info>Many destinations require Level 2 verification before activation.</Info>

## Channel limits

Channels represent concurrent call capacity. Each active call consumes one channel.

Set channel limits per profile to control concurrency and prevent service degradation.

## Billing configuration

### Rate deck

Calls are rated based on destination number prefix. Download current rate decks or request custom rates through an account representative.

### Max destination rate

Set a maximum per-minute rate threshold. Calls to destinations exceeding this rate are rejected automatically.

```
Example: Max rate $0.10/min rejects calls to $0.15/min destinations
```

### Daily spend limit

Define maximum spend per day per connection. Limits reset at 00:00:00 UTC.

Prevents unexpected overages from misconfigured systems or traffic anomalies.

## Call recording

Enable recording for all outbound calls or specific ANI numbers.

| Setting  | Options                                      |
| -------- | -------------------------------------------- |
| Format   | WAV, MP3                                     |
| Channels | Mono (single-channel), Stereo (dual-channel) |
| Scope    | All calls or specific ANI list               |
