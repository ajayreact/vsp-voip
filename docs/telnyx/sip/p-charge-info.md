---
title: "P-Charge-Info"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/configuration/p-charge-info-header.md"
category: "sip"
synced_at: "2026-06-25T18:30:06.941Z"
content_hash: "bc3da499cdb878bb401c68186357e00fdda98560b4c3e79130737a5695e66eef"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# P-Charge-Info Header

> Use the P-Charge-Info SIP header on Telnyx SIP Trunking to specify the billed number for outbound calls. Includes header format and behavior rules.

A SIP header that identifies the billing number (DID) for outbound calls, enabling accurate call attribution and routing through Telnyx SIP trunks.

## Header format

```
P-Charge-Info: <sip:+15551234567@sip.telnyx.com>
```

The value must be:

* A valid DID associated with the Telnyx SIP connection
* In E.164 format (e.g., `+15551234567`)
* Wrapped in SIP URI format

## Use cases

* Multiple DIDs on a single SIP connection
* Call detail record (CDR) attribution per DID
* Billing and usage tracking per number
* Carrier-side call routing based on originating number

## Requirements

* Telnyx SIP connection configured for outbound calling
* Valid DID ownership and assignment to the connection
* PBX access to modify dialplan or trunk configuration

## Troubleshooting

| Issue                              | Solution                                              |
| ---------------------------------- | ----------------------------------------------------- |
| Header not appearing in SIP INVITE | Verify dialplan reload completed successfully         |
| Call rejected by Telnyx            | Confirm DID is associated with the SIP connection     |
| Wrong number in header             | Check variable substitution in dynamic configurations |
| FreePBX updates overwrite config   | Use `extensions_custom.conf` to persist changes       |

## Alternative identification methods

For connections sharing authentication credentials:

| Method                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| P-Charge-Info header    | SIP header identifying billing number       |
| Tech prefix             | 4-digit identifier prepended to destination |
| IP authentication token | Token-based connection validation           |
