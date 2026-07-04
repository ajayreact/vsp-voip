---
title: "JWTs"
source_url: "https://developers.telnyx.com/docs/voice/webrtc/auth/jwt.md"
category: "webrtc"
synced_at: "2026-06-25T18:36:07.701Z"
content_hash: "8b1ffc22a042110b789dad6bda8b7442f603befcb254eb9c96a294ae6d195ca9"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Voice SDK Authentication via JWTs

> Authenticate the Telnyx Voice WebRTC SDKs with short-lived JWT tokens. Generate, refresh, and validate tokens for secure browser and mobile clients.

## Prerequisites

* An active telephony credential

## Create a Token

The following API request will generate a JWT.

```http theme={null}
POST /v2/telephony_credentials/:id/token HTTP/1.1
Host: api.telnyx.com
Authorization: Bearer XXX
```

This JWT is valid until:

* 24 hours after its creation or
* the parent telephony credential is expired

whichever comes first

## SDK Authentication

SDKs are authenticated with the JWT.

## Limits

Currently, there exists

* No limit on count of tokens on a telephony credential,
* Nor any limit on the aggregate count of tokens on a single account.

## Additional Resources

* [JWT API Reference](https://developers.telnyx.com/docs/voice/webrtc/auth/jwt/index#create-a-token)
