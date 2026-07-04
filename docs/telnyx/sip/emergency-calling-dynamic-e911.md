---
title: "Dynamic E911"
source_url: "https://developers.telnyx.com/docs/voice/sip-trunking/emergency-calling-dynamic-e911.md"
category: "sip"
synced_at: "2026-06-25T18:43:21.647Z"
content_hash: "01cc3d47dc24fb8dde0a3df9de466b376b0035d4ae4da5f2d5bce55e8cce931e"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Dynamic E911

> Provision Dynamic E911 on Telnyx SIP Trunking for VoIP emergency calling. Register caller locations dynamically and route 911 calls to the correct PSAP.

Dynamic E911 delivers location information to PSAPs during emergency calls. Two methods available:

| Method              | Use case                             | Location source         |
| ------------------- | ------------------------------------ | ----------------------- |
| API-based addresses | Fixed locations (offices, buildings) | Pre-provisioned via API |
| GPS coordinates     | Mobile devices, wearables, IoT       | PIDF-LO in SIP INVITE   |

## API-based addresses

Pre-provision addresses and endpoints, then reference IDs in SIP headers during calls.

<Callout type="warning">
  Dynamically provisioning emergency endpoints may result in a delay before the associated address is fully available for routing. Telnyx recommends pre-provisioning a persistent emergency address rather than relying on just-in-time provisioning.
  In circumstances where an emergency call (e.g., 911) is initiated before a dynamically provisioned endpoint is fully activated, the call will be routed to a national emergency call center (PSAP) .
</Callout>

### Create emergency address

[POST /v2/dynamic\_emergency\_addresses](/api-reference/dynamic-emergency-addresses/create-a-dynamic-emergency-address)

```json theme={null}
{
  "house_number": "1901",
  "street_pre_directional": "W",
  "street_name": "MADISON",
  "street_suffix": "ST",
  "locality": "CHICAGO",
  "administrative_area": "IL",
  "postal_code": "60612",
  "country_code": "US"
}
```

Response includes:

* `id` - Address UUID for endpoint association
* `sip_geolocation_id` - Include in `Geolocation` header
* `status` - `pending` during validation, `activated` when ready

### Create emergency endpoint

[POST /v2/dynamic\_emergency\_endpoints](/api-reference/dynamic-emergency-endpoints/create-a-dynamic-emergency-endpoint)

```json theme={null}
{
  "dynamic_emergency_address_id": "uuid-from-address",
  "callback_number": "+13125550000",
  "caller_name": "Jane Doe"
}
```

Response includes:

* `sip_from_id` - Include in `From` or `P-Asserted-Identity` header

### SIP INVITE format

Include both IDs in emergency call INVITE:

```
INVITE sip:911@sip.telnyx.com SIP/2.0
From: <sip:{sip_from_id}@origin.example.com>
To: <sip:911@sip.telnyx.com>
Geolocation: {sip_geolocation_id}
```

Alternative using `P-Asserted-Identity`:

```
P-Asserted-Identity: <sip:{sip_from_id}@origin.example.com>
Geolocation: {sip_geolocation_id}
```

<div style={{ width: '100%', height: '4px', background: 'linear-gradient(to right, #00c08b, transparent)', borderRadius: '2px', margin: '2rem 0' }} />

## GPS coordinates (PIDF-LO)

Pass real-time coordinates in PIDF-LO format for mobile devices, wearables, and IoT.

### Coordinate format

| Parameter | Range              | Notes                |
| --------- | ------------------ | -------------------- |
| Latitude  | -90 to +90         | Negative = South     |
| Longitude | -180 to +180       | Negative = West      |
| Precision | 6-8 decimal places | Meter-level accuracy |

### SIP INVITE Format for PIDF-LO with GPS Coordinates

```
INVITE sip:911@sip.telnyx.com SIP/2.0
From: <sip:+13125550100@sip.telnyx.com>
To: <sip:911@sip.telnyx.com>
Geolocation: <cid:location@example.com>
X-Latitude: latitude
X-Longitude: longitude
Content-Type: application/sdp
[SDP content]
```

<div style={{ width: '100%', height: '4px', background: 'linear-gradient(to right, #00c08b, transparent)', borderRadius: '2px', margin: '2rem 0' }} />

### SIP INVITE Format for PIDF-LO with MiMe

```
INVITE sip:911@sip.telnyx.com SIP/2.0
From: <sip:+13125550100@sip.telnyx.com>
To: <sip:911@sip.telnyx.com>
Geolocation: <cid:location@example.com>
Content-Type: multipart/mixed;boundary=boundary1

--boundary1
Content-Type: application/sdp

[SDP content]

--boundary1
Content-Type: application/pidf+xml
Content-ID: <location@example.com>

<?xml version="1.0" encoding="UTF-8"?>
<presence xmlns="urn:ietf:params:xml:ns:pidf"
          xmlns:gp="urn:ietf:params:xml:ns:pidf:geopriv10"
          xmlns:gml="http://www.opengis.net/gml"
          xmlns:dm="urn:ietf:params:xml:ns:pidf:data-model"
          entity="sip:+13125550100@sip.telnyx.com">
  <dm:device id="device-001">
    <gp:geopriv>
      <gp:location-info>
        <gml:Point srsName="urn:ogc:def:crs:EPSG::4326">
          <gml:pos>41.8781 -87.6298</gml:pos>
        </gml:Point>
      </gp:location-info>
      <gp:usage-rules>
        <gp:retransmission-allowed>false</gp:retransmission-allowed>
      </gp:usage-rules>
    </gp:geopriv>
    <dm:timestamp>2024-01-15T10:30:00Z</dm:timestamp>
  </dm:device>
</presence>

--boundary1--
```

<Callout type="info">
  Telnyx currently supports LIS and ASSIST as PIDF-LO methods.<br />
  Other methods are not supported.
</Callout>

### PIDF-LO requirements

| Element          | Requirement                              |
| ---------------- | ---------------------------------------- |
| `<gml:pos>`      | Latitude then longitude, space-separated |
| `srsName`        | Must be `urn:ogc:def:crs:EPSG::4326`     |
| `<dm:timestamp>` | ISO 8601 format                          |

<div style={{ width: '100%', height: '4px', background: 'linear-gradient(to right, #00c08b, transparent)', borderRadius: '2px', margin: '2rem 0' }} />

## Testing

Use test number `933` to simulate emergency calls without dispatching services.

## Address field limits

| Field                     | Required | Max Length | PIDF-LO Element |
| ------------------------- | -------- | ---------- | --------------- |
| house\_number             | No       | 6          | HNO             |
| house\_suffix             | No       | 45         | HNS             |
| street\_pre\_directional  | No       | 2          | PRD             |
| street\_name              | Yes      | 200        | RD              |
| street\_suffix            | No       | 45         | STS             |
| street\_post\_directional | No       | 2          | POD             |
| extended\_address         | No       | 60\*       | LOC             |
| locality                  | Yes      | 100        | A3              |
| administrative\_area      | Yes      | 2          | A1              |
| postal\_code              | Yes      | 10         | PC              |
| country\_code             | Yes      | 2          | country         |
| caller\_name              | No       | 50         | -               |

\*Common terms auto-abbreviated: APARTMENT→APT, FLOOR→FL, SUITE→STE, BUILDING→BLDG, ROOM→RM
