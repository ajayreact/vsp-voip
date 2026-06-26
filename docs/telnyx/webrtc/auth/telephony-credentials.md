---
title: "Telephony Credentials"
source_url: "https://developers.telnyx.com/docs/voice/webrtc/auth/telephony-credentials.md"
category: "webrtc"
synced_at: "2026-06-25T18:35:59.230Z"
content_hash: "7fe97e5513a089a721c529012bfd0c9c2ce4ee2fd151cfb1c9ef023526f3c869"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Voice SDK Authentication via Telephony Credentials

> Authenticate the Telnyx Voice WebRTC SDKs with telephony credentials. Create per-user logins tied to a SIP connection for browser and mobile apps.

## Prerequisites

* An active credential based SIP connection

## Create a Credential

The following API request will create a telephony credential.

```http theme={null}
POST /v2/telephony_credentials HTTP/1.1
Host: api.telnyx.com
Content-Type: application/json
Authorization: Bearer XXX
Content-Length: 75

{
  "connection_id": "1567510696929005999",
  "expires_at": "2024-09-18T00:00:00",
  "name": "contact-center-1",
  "tag": "sandbox"
}
```

* `connection_id` is required
* `expires_at` is recommended for security especially when many are expected to be created
* `name` and `tag` are recommended for easy management

Multiple telephony credentials can be created on a single connection.

## Updating a Credential

After a credential's creation, it may be updated via the PATCH endpoint.

```http theme={null}
PATCH /v2/telephony_credentials/:id HTTP/1.1
Host: api.telnyx.com
Content-Type: application/json
Authorization: Bearer XXX
Content-Length: 83

{
  "expires_at": "2024-09-11T21:07:00"
}
```

The following error will be returned when trying to perform updates on an `expired` credential since that state is terminal.

```http theme={null}
{
    "errors": {
        "status": "can't update credentials in expired status"
    }
}
```

An expired credential can only be deleted.

## Revoking a Credential

A client-side application’s voice capabilities can be revoked by removing the corresponding credential.

```http theme={null}
DELETE /v2/telephony_credentials/:id HTTP/1.1
Host: api.telnyx.com
Content-Type: application/json
Authorization: Bearer XXX
```

## Managing Credentials

The following filters are useful when managing many credentials.

* `filter[resource_id]` e.g. `filter[resource_id]=connection:1567510696929005999`. Note that `connection:` must be prepended to the connection ID.
* `filter[status]` e.g. `filter[status]=expired`
* `filter[status]` e.g. `filter[tag]=sandbox`

```http theme={null}
GET /v2/telephony_credentials?filter[status]=expired&filter[tag]=sandbox HTTP/1.1
Host: api.telnyx.com
Authorization: Bearer XXX
```

## SDK Authentication

SDKs are authenticated with

* `sip_username` which starts with `gencred`
* `sip_password`

## Limits

Currently, there exists

* No limit on count of telephony credentials on a connection,
* Nor any limit on the aggregate count of telephony credentials on a single account.

## Additional Resources

* [Telephony Credentials API Reference](https://developers.telnyx.com/docs/voice/webrtc/auth/telephony-credentials/index#create-a-credential)
