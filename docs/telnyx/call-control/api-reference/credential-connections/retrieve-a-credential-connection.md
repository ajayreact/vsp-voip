---
title: "Retrieve a credential connection"
source_url: "https://developers.telnyx.com/api-reference/credential-connections/retrieve-a-credential-connection.md"
category: "sip"
synced_at: "2026-06-25T18:43:23.869Z"
content_hash: "e4e93ac34349413a370315c46087f02e173bd2280ce98c145f8e8356d749761a"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Retrieve a credential connection

> Retrieves the details of an existing credential connection.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/sip-connections.yml get /credential_connections/{id}
openapi: 3.1.0
info:
  title: Telnyx SIP Connections API
  version: 2.0.0
  description: API for SIP connections.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /credential_connections/{id}:
    get:
      tags:
        - Credential Connections
      summary: Retrieve a credential connection
      description: Retrieves the details of an existing credential connection.
      operationId: RetrieveCredentialConnection
      parameters:
        - name: id
          in: path
          description: Identifies the resource.
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Successful response with details about a credential connection.
          content:
            application/json:
              schema:
                type: object
                title: Credential Connection Response
                properties:
                  data:
                    $ref: '#/components/schemas/CredentialConnection'
        '400':
          $ref: '#/components/responses/connections_BadRequestResponse'
        '401':
          $ref: '#/components/responses/UnauthenticatedResponse'
        '403':
          $ref: '#/components/responses/connections_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/connections_NotFoundResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const credentialConnection = await
            client.credentialConnections.retrieve('id');


            console.log(credentialConnection.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            credential_connection = client.credential_connections.retrieve(
                "id",
            )
            print(credential_connection.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tcredentialConnection, err := client.CredentialConnections.Get(context.TODO(), \"id\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", credentialConnection.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.credentialconnections.CredentialConnectionRetrieveParams;

            import
            com.telnyx.sdk.models.credentialconnections.CredentialConnectionRetrieveResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    CredentialConnectionRetrieveResponse credentialConnection = client.credentialConnections().retrieve("id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            credential_connection = telnyx.credential_connections.retrieve("id")

            puts(credential_connection)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $credentialConnection = $client->credentialConnections->retrieve('id');

              var_dump($credentialConnection);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx credential-connections retrieve \
              --api-key 'My API Key' \
              --id id
components:
  schemas:
    CredentialConnection:
      type: object
      title: Credential Connection
      properties:
        id:
          type: string
          description: Identifies the type of resource.
          example: '1293384261075731499'
          x-format: int64
        record_type:
          type: string
          description: Identifies the type of the resource.
          example: credential_connection
        active:
          type: boolean
          description: Defaults to true
        user_name:
          type: string
          description: >-
            The user name to be used as part of the credentials. Must be 4-32
            characters long and alphanumeric values only (no spaces or special
            characters). At least one of the first 5 characters must be a
            letter.
          example: myusername123
        password:
          type: string
          description: >-
            The password to be used as part of the credentials. Must be 8 to 128
            characters long.
          example: my123secure456password789
        created_at:
          type: string
          description: ISO-8601 formatted date indicating when the resource was created.
          example: '2018-02-02T22:25:27.521Z'
        updated_at:
          type: string
          description: ISO-8601 formatted date indicating when the resource was updated.
          example: '2018-02-02T22:25:27.521Z'
        anchorsite_override:
          $ref: '#/components/schemas/AnchorsiteOverride'
        connection_name:
          type: string
        sip_uri_calling_preference:
          type: string
          example: disabled
          description: >-
            This feature enables inbound SIP URI calls to your Credential Auth
            Connection. If enabled for all (unrestricted) then anyone who calls
            the SIP URI <your-username>@telnyx.com will be connected to your
            Connection. You can also choose to allow only calls that are
            originated on any Connections under your account (internal).
          enum:
            - disabled
            - unrestricted
            - internal
        default_on_hold_comfort_noise_enabled:
          type: boolean
          default: true
          description: >-
            When enabled, Telnyx will generate comfort noise when you place the
            call on hold. If disabled, you will need to generate comfort noise
            or on hold music to avoid RTP timeout.
        dtmf_type:
          $ref: '#/components/schemas/DtmfType'
        encode_contact_header_enabled:
          type: boolean
          default: false
          description: >-
            Encode the SIP contact header sent by Telnyx to avoid issues for NAT
            or ALG scenarios.
        encrypted_media:
          $ref: '#/components/schemas/EncryptedMedia'
        onnet_t38_passthrough_enabled:
          type: boolean
          default: false
          description: >-
            Enable on-net T38 if you prefer the sender and receiver negotiating
            T38 directly if both are on the Telnyx network. If this is disabled,
            Telnyx will be able to use T38 on just one leg of the call depending
            on each leg's settings.
        ios_push_credential_id:
          $ref: '#/components/schemas/ConnectionIosPushCredentialId'
        android_push_credential_id:
          $ref: '#/components/schemas/ConnectionAndroidPushCredentialId'
        webhook_event_url:
          type: string
          format: uri
          description: >-
            The URL where webhooks related to this connection will be sent. Must
            include a scheme, such as 'https'.
          example: https://example.com
        webhook_event_failover_url:
          type:
            - string
            - 'null'
          format: uri
          description: >-
            The failover URL where webhooks related to this connection will be
            sent if sending to the primary URL fails. Must include a scheme,
            such as 'https'.
          example: https://failover.example.com
          default: ''
        webhook_api_version:
          description: Determines which webhook format will be used, Telnyx API v1 or v2.
          type: string
          enum:
            - '1'
            - '2'
          default: '1'
          example: '1'
        webhook_timeout_secs:
          type:
            - integer
            - 'null'
          minimum: 0
          maximum: 30
          description: Specifies how many seconds to wait before timing out a webhook.
          example: 25
          default: null
        call_cost_in_webhooks:
          type: boolean
          description: Specifies if call cost webhooks should be sent for this connection.
          default: false
        tags:
          type: array
          items:
            type: string
          description: Tags associated with the connection.
          example:
            - tag1
            - tag2
        rtcp_settings:
          $ref: '#/components/schemas/ConnectionRtcpSettings'
        inbound:
          $ref: '#/components/schemas/CredentialInbound'
        outbound:
          $ref: '#/components/schemas/CredentialOutbound'
        noise_suppression:
          $ref: '#/components/schemas/ConnectionNoiseSuppression'
        noise_suppression_details:
          $ref: '#/components/schemas/ConnectionNoiseSuppressionDetails'
        jitter_buffer:
          $ref: '#/components/schemas/ConnectionJitterBuffer'
      example:
        id: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
        record_type: credential_connection
        active: true
        user_name: myusername123
        password: my123secure456password789
        created_at: '2018-02-02T22:25:27.521Z'
        updated_at: '2018-02-02T22:25:27.521Z'
        anchorsite_override: Latency
        connection_name: string
        sip_uri_calling_preference: disabled
        default_on_hold_comfort_noise_enabled: true
        dtmf_type: RFC 2833
        encode_contact_header_enabled: true
        encrypted_media: SRTP
        onnet_t38_passthrough_enabled: true
        ios_push_credential_id: ec0c8e5d-439e-4620-a0c1-9d9c8d02a836
        android_push_credential_id: 06b09dfd-7154-4980-8b75-cebf7a9d4f8e
        webhook_event_url: https://example.com
        webhook_event_failover_url: https://failover.example.com
        webhook_api_version: '1'
        call_cost_in_webhooks: false
        webhook_timeout_secs: 25
        tags:
          - tag1
          - tag2
        rtcp_settings:
          port: rtp+1
          capture_enabled: true
          report_frequency_secs: 10
        inbound:
          ani_number_format: +E.164
          dnis_number_format: +e164
          codecs:
            - G722
          channel_limit: 10
          generate_ringback_tone: true
          isup_headers_enabled: true
          prack_enabled: true
          sip_compact_headers_enabled: true
          timeout_1xx_secs: 10
          timeout_2xx_secs: 15
          shaken_stir_enabled: true
          simultaneous_ringing: enabled
        outbound:
          call_parking_enabled: true
          ani_override: string
          ani_override_type: always
          channel_limit: 10
          instant_ringback_enabled: true
          generate_ringback_tone: true
          localization: string
          t38_reinvite_source: customer
          outbound_voice_profile_id: '1293384261075731499'
        noise_suppression: both
        noise_suppression_details:
          engine: deep_filter_net
          attenuation_limit: 80
        jitter_buffer:
          enable_jitter_buffer: true
          jitterbuffer_msec_min: 60
          jitterbuffer_msec_max: 200
    AnchorsiteOverride:
      title: Anchorsite Override
      type: string
      description: >-
        `Latency` directs Telnyx to route media through the site with the lowest
        round-trip time to the user's connection. Telnyx calculates this time
        using ICMP ping messages. This can be disabled by specifying a site to
        handle all media.
      enum:
        - Latency
        - Chicago, IL
        - Ashburn, VA
        - San Jose, CA
        - Sydney, Australia
        - Amsterdam, Netherlands
        - London, UK
        - Toronto, Canada
        - Vancouver, Canada
        - Frankfurt, Germany
      default: Latency
      example: Amsterdam, Netherlands
    DtmfType:
      title: DTMF Type
      type: string
      description: >-
        Sets the type of DTMF digits sent from Telnyx to this Connection. Note
        that DTMF digits sent to Telnyx will be accepted in all formats.
      enum:
        - RFC 2833
        - Inband
        - SIP INFO
      default: RFC 2833
      example: Inband
    EncryptedMedia:
      type:
        - string
        - 'null'
      enum:
        - SRTP
        - null
      example: SRTP
      description: >-
        Enable use of SRTP for encryption. Cannot be set if the
        transport_portocol is TLS.
    ConnectionIosPushCredentialId:
      title: Ios Push Credential Id
      type:
        - string
        - 'null'
      description: The uuid of the push credential for Ios
      example: ec0c8e5d-439e-4620-a0c1-9d9c8d02a836
      default: null
    ConnectionAndroidPushCredentialId:
      title: Android Push Credential Id
      type:
        - string
        - 'null'
      description: The uuid of the push credential for Android
      example: 06b09dfd-7154-4980-8b75-cebf7a9d4f8e
      default: null
    ConnectionRtcpSettings:
      type: object
      title: Connection RTCP Settings
      properties:
        port:
          enum:
            - rtcp-mux
            - rtp+1
          default: rtp+1
          description: RTCP port by default is rtp+1, it can also be set to rtcp-mux
          type: string
        capture_enabled:
          type: boolean
          default: false
          description: >-
            BETA - Enable the capture and storage of RTCP messages to create QoS
            reports on the Telnyx Mission Control Portal.
          example: true
        report_frequency_secs:
          type: integer
          default: 5
          description: >-
            RTCP reports are sent to customers based on the frequency set.
            Frequency is in seconds and it can be set to values from 5 to 3000
            seconds.
          example: 10
      example:
        port: rtcp-mux
        capture_enabled: true
        report_frequency_secs: 10
    CredentialInbound:
      type: object
      title: Credential Inbound
      example:
        ani_number_format: +E.164
        dnis_number_format: +e164
        codecs:
          - G722
        default_routing_method: sequential
        channel_limit: 10
        generate_ringback_tone: true
        isup_headers_enabled: true
        prack_enabled: true
        sip_compact_headers_enabled: true
        timeout_1xx_secs: 10
        timeout_2xx_secs: 20
        shaken_stir_enabled: true
        simultaneous_ringing: enabled
      properties:
        ani_number_format:
          type: string
          enum:
            - +E.164
            - E.164
            - +E.164-national
            - E.164-national
          default: E.164-national
          description: >-
            This setting allows you to set the format with which the caller's
            number (ANI) is sent for inbound phone calls.
        dnis_number_format:
          type: string
          enum:
            - +e164
            - e164
            - national
            - sip_username
          default: e164
        codecs:
          type: array
          items:
            type: string
          description: >-
            Defines the list of codecs that Telnyx will send for inbound calls
            to a specific number on your portal account, in priority order. This
            only works when the Connection the number is assigned to uses Media
            Handling mode: default. OPUS and H.264 codecs are available only
            when using TCP or TLS transport for SIP.
          default:
            - G722
            - G711U
            - G711A
            - G729
            - OPUS
            - H.264
        default_routing_method:
          type: string
          enum:
            - sequential
            - round-robin
          description: >-
            Default routing method to be used when a number is associated with
            the connection. Must be one of the routing method types or left
            blank, other values are not allowed.
        channel_limit:
          type: integer
          default: null
          description: >-
            When set, this will limit the total number of inbound calls to phone
            numbers associated with this connection.
        generate_ringback_tone:
          type: boolean
          default: false
          description: >-
            Generate ringback tone through 183 session progress message with
            early media.
        isup_headers_enabled:
          type: boolean
          default: false
          description: >-
            When set, inbound phone calls will receive ISUP parameters via SIP
            headers. (Only when available and only when using TCP or TLS
            transport.)
        prack_enabled:
          type: boolean
          description: Enable PRACK messages as defined in RFC3262.
          default: false
        sip_compact_headers_enabled:
          type: boolean
          description: Defaults to true.
          default: true
        timeout_1xx_secs:
          type: integer
          description: Time(sec) before aborting if connection is not made.
          minimum: 1
          maximum: 120
          default: 3
        timeout_2xx_secs:
          type: integer
          description: 'Time(sec) before aborting if call is unanswered (min: 1, max: 600).'
          minimum: 1
          maximum: 600
          default: 90
        shaken_stir_enabled:
          type: boolean
          description: >-
            When enabled the SIP Connection will receive the Identity header
            with Shaken/Stir data in the SIP INVITE message of inbound calls,
            even when using UDP transport.
          default: false
        simultaneous_ringing:
          type: string
          description: >-
            When enabled, allows multiple devices to ring simultaneously on
            incoming calls.
          default: disabled
          enum:
            - disabled
            - enabled
    CredentialOutbound:
      type: object
      title: Credential Outbound
      example:
        call_parking_enabled: true
        ani_override: always
        channel_limit: 10
        instant_ringback_enabled: true
        generate_ringback_tone: true
        localization: US
        t38_reinvite_source: customer
        outbound_voice_profile_id: '1293384261075731499'
      properties:
        call_parking_enabled:
          type:
            - boolean
            - 'null'
          default: false
          description: >-
            Forces all SIP calls originated on this connection to be "parked"
            instead of "bridged" to the destination specified on the URI. Parked
            calls will return ringback to the caller and will await for a Call
            Control command to define which action will be taken next.
        ani_override:
          type: string
          description: >-
            Set a phone number as the ani_override value to override caller id
            number on outbound calls.
          default: ''
        ani_override_type:
          type: string
          enum:
            - always
            - normal
            - emergency
          description: >-
            Specifies when we apply your ani_override setting. Only applies when
            ani_override is not blank.
          default: always
        channel_limit:
          type: integer
          default: null
          description: >-
            When set, this will limit the total number of outbound calls to
            phone numbers associated with this connection.
        instant_ringback_enabled:
          type: boolean
          default: true
          description: >-
            When set, ringback will not wait for indication before sending
            ringback tone to calling party.
        generate_ringback_tone:
          type: boolean
          default: false
          description: >-
            Generate ringback tone through 183 session progress message with
            early media.
        localization:
          type: string
          default: US
          description: >-
            A 2-character country code specifying the country whose national
            dialing rules should be used. For example, if set to `US` then any
            US number can be dialed without preprending +1 to the number. When
            left blank, Telnyx will try US and GB dialing rules, in that order,
            by default.
          example: US
        t38_reinvite_source:
          type: string
          enum:
            - telnyx
            - customer
            - disabled
            - passthru
            - caller-passthru
            - callee-passthru
          description: >-
            This setting only affects connections with Fax-type Outbound Voice
            Profiles. The setting dictates whether or not Telnyx sends a t.38
            reinvite.<br/><br/> By default, Telnyx will send the re-invite. If
            set to `customer`, the caller is expected to send the t.38 reinvite.
          default: telnyx
        outbound_voice_profile_id:
          $ref: '#/components/schemas/connections_OutboundVoiceProfileId'
    ConnectionNoiseSuppression:
      type: string
      description: >-
        Controls when noise suppression is applied to calls. When set to
        'inbound', noise suppression is applied to incoming audio. When set to
        'outbound', it's applied to outgoing audio. When set to 'both', it's
        applied in both directions. When set to 'disabled', noise suppression is
        turned off.
      enum:
        - inbound
        - outbound
        - both
        - disabled
      example: both
    ConnectionNoiseSuppressionDetails:
      type: object
      description: >-
        Configuration options for noise suppression. These settings are stored
        regardless of the noise_suppression value, but only take effect when
        noise_suppression is not 'disabled'. If you disable noise suppression
        and later re-enable it, the previously configured settings will be used.
      properties:
        engine:
          type: string
          description: >-
            The noise suppression engine to use. 'denoiser' is the default
            engine. 'deep_filter_net' and 'deep_filter_net_large' are
            alternative engines with different performance characteristics.
            Krisp engines ('krisp_viva_tel', 'krisp_viva_tel_lite',
            'krisp_viva_promodel', 'krisp_viva_ss') provide advanced noise
            suppression capabilities. 'quail_voice_focus' provides Quail-based
            voice focus noise suppression.
          enum:
            - denoiser
            - deep_filter_net
            - deep_filter_net_large
            - krisp_viva_tel
            - krisp_viva_tel_lite
            - krisp_viva_promodel
            - krisp_viva_ss
            - quail_voice_focus
          default: denoiser
          example: deep_filter_net
        attenuation_limit:
          type: integer
          description: >-
            The attenuation limit value for the selected engine. Default values
            vary by engine: 0 for 'denoiser', 80 for 'deep_filter_net',
            'deep_filter_net_large', and all Krisp engines ('krisp_viva_tel',
            'krisp_viva_tel_lite', 'krisp_viva_promodel', 'krisp_viva_ss'), 100
            for 'quail_voice_focus'.
          minimum: 0
          maximum: 100
          multipleOf: 10
          example: 80
    ConnectionJitterBuffer:
      type: object
      description: >-
        Configuration options for Jitter Buffer. Enables Jitter Buffer for RTP
        streams of SIP Trunking calls. The feature is off unless enabled. You
        may define min and max values in msec for customized buffering
        behaviors. Larger values add latency but tolerate more jitter, while
        smaller values reduce latency but are more sensitive to jitter and
        reordering.
      properties:
        enable_jitter_buffer:
          type: boolean
          description: >-
            Enables Jitter Buffer for RTP streams of SIP Trunking calls. The
            feature is off unless enabled.
          default: false
          example: true
        jitterbuffer_msec_min:
          type: integer
          description: >-
            The minimum jitter buffer size in milliseconds. Must be between 40
            and 400. Has no effect if enable_jitter_buffer is not true.
          minimum: 40
          maximum: 400
          default: 60
          example: 60
        jitterbuffer_msec_max:
          type: integer
          description: >-
            The maximum jitter buffer size in milliseconds. Must be between 40
            and 400. Has no effect if enable_jitter_buffer is not true.
          minimum: 40
          maximum: 400
          default: 200
          example: 200
    ErrorResponse:
      type: object
      properties:
        errors:
          type: array
          items:
            type: object
            properties:
              code:
                type: string
              detail:
                type: string
              meta:
                type: object
                properties:
                  url:
                    type: string
                    format: uri
              title:
                type: string
              source:
                type: object
                properties:
                  pointer:
                    type: string
    connections_OutboundVoiceProfileId:
      title: Outbound Voice Profile ID
      type: string
      description: Identifies the associated outbound voice profile.
      example: '1293384261075731499'
      x-format: int64
  responses:
    connections_BadRequestResponse:
      description: >-
        Bad request, the request was unacceptable, often due to missing a
        required parameter.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            missingParameter:
              value:
                errors:
                  - code: '10015'
                    title: Bad Request
                    detail: The request failed because it was not well-formed.
                    source:
                      pointer: /
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10015
    UnauthenticatedResponse:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            Authentication Failed:
              value:
                errors:
                  - code: '10009'
                    title: Authentication failed
                    detail: Could not understand the provided credentials.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10009
    connections_UnauthorizedResponse:
      description: >-
        The user doesn't have the required permissions to perform the requested
        action.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            notAuthorized:
              value:
                errors:
                  - code: '10010'
                    title: Not authorized
                    detail: You are not authorized to access the requested resource.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10010
                    source:
                      pointer: /
    connections_NotFoundResponse:
      description: The requested resource doesn't exist.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          examples:
            notFound:
              value:
                errors:
                  - code: '10005'
                    title: Resource not found
                    detail: The requested resource or URL could not be found.
                    meta:
                      url: https://developers.telnyx.com/docs/overview/errors/10005
                    source:
                      pointer: /
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
