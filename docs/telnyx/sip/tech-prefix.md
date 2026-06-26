---
title: "Tech Prefix"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/authentication/tech-prefix.md"
category: "sip"
synced_at: "2026-06-25T18:29:40.594Z"
content_hash: "89042af6046ba6bf06b946309c7772851d012b984c3157ba1adc6635aa624313"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Tech Prefix Authentication

> Authenticate Telnyx SIP Trunking calls with a tech prefix. Prepend a numeric prefix to the request URI to identify your account on outbound INVITEs.

A 4-digit identifier prepended to outbound calls to differentiate multiple SIP connections sharing the same IP address.

## Dial string format

```
[tech_prefix][destination_number]
```

Example: Tech prefix `1234` + destination `+18005678912` = `123418005678912`

## Use cases

* Multiple SIP connections from the same IP address
* Granular call routing and billing per connection
* Traffic stream separation

## Configuration

[PATCH /v2/ip\_connections/{id}](/api-reference/ip-connections/update-an-ip-connection)

```json theme={null}
{
  "inbound": {
    "sip_subdomain_receive_settings": "from_anyone"
  },
  "outbound": {
    "tech_prefix_enabled": true
  }
}
```

Tech prefix value is assigned by Telnyx and visible in the connection settings.

## Phone system setup

The PBX or SIP client must prepend the tech prefix to all outbound calls on the trunk.

## Authentication behavior

| Condition                    | Result                              |
| ---------------------------- | ----------------------------------- |
| Correct tech prefix included | Call authenticated                  |
| Missing or incorrect prefix  | `407 Proxy Authentication Required` |

## Alternative authentication methods

For connections sharing an IP address:

| Method                  | Description                  |
| ----------------------- | ---------------------------- |
| Tech prefix             | 4-digit prepended identifier |
| IP authentication token | Token-based validation       |
| P-Charge-Info header    | SIP header-based routing     |
