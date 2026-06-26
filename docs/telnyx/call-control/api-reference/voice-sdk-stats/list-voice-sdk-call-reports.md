---
title: "List Voice SDK call reports"
source_url: "https://developers.telnyx.com/api-reference/voice-sdk-stats/list-voice-sdk-call-reports.md"
category: "call-control"
synced_at: "2026-06-25T18:43:00.244Z"
content_hash: "e8bbeacd244ad1abe3ec493f72385d1b528d752ed9a3eb366ca6958a38d20f74"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List Voice SDK call reports

> Returns paginated raw call report stats JSON payloads stored for the authenticated user. The user is derived from Telnyx authentication, not from request parameters.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/voice-sdk-call-reports.yml get /voice_sdk_call_reports
openapi: 3.1.0
info:
  title: Telnyx Voice SDK Call Reports API
  version: 2.0.0
  description: >-
    Access Voice SDK call report data including WebRTC quality metrics, ICE
    connectivity state, and debug logs. Reports are scoped to the authenticated
    user's calls.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /voice_sdk_call_reports:
    get:
      tags:
        - Voice SDK Stats
      summary: List Voice SDK call reports
      description: >-
        Returns paginated raw call report stats JSON payloads stored for the
        authenticated user. The user is derived from Telnyx authentication, not
        from request parameters.
      operationId: ListVoiceSdkCallReports
      parameters:
        - $ref: '#/components/parameters/voice-sdk-debug_PageConsolidated'
        - $ref: '#/components/parameters/VoiceSdkCallReportSort'
      responses:
        '200':
          description: Paginated raw call report stats payloads.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VoiceSdkCallReportListResponse'
              examples:
                reports:
                  summary: Call report list
                  value:
                    data:
                      - call_id: 6d6fb6f1-2b82-4d75-9eb5-3c8e995f1ed1
                        voice_sdk_id: VSDK1Cu-AUDpaCkbs5LKcSUK9jLZFcgqLdg
                        voice_sdk_session_id: 0a52a677-9784-4841-ad31-9596c6e5b970
                        voice_sdk_id_decoded:
                          region: us-central-1
                        user_agent: TelnyxRTC/2.24.0 (iOS 17.5)
                        version: 2.24.0
                        telnyx_session_id: 9a0f6b0e-fb1f-44c9-9b53-7f81442b4c5f
                        telnyx_leg_id: 2d0dd8f1-7d90-4f1f-b8e8-67f9fbdfe2bd
                        stored_at: '2026-05-06T20:00:05Z'
                        summary:
                          callId: 6d6fb6f1-2b82-4d75-9eb5-3c8e995f1ed1
                        stats:
                          - intervalStartUtc: '2026-05-06T20:00:00Z'
                            intervalEndUtc: '2026-05-06T20:00:05Z'
                            audio:
                              inbound:
                                packetsReceived: 1840
                                packetsLost: 0
                                jitterAvg: 0.003
                              outbound:
                                packetsSent: 1837
                                bytesSent: 293920
                            connection:
                              roundTripTimeAvg: 0.041
                              bytesSent: 293920
                              bytesReceived: 312880
                            ice:
                              state: succeeded
                              nominated: true
                              local:
                                candidateType: host
                                protocol: udp
                              remote:
                                candidateType: srflx
                                protocol: udp
                            transport:
                              iceState: connected
                              dtlsState: connected
                              srtpCipher: AES_CM_128_HMAC_SHA1_80
                        logs:
                          - timestamp: '2026-05-06T20:00:00Z'
                            level: debug
                            message: rtcpeer candidate selected
                            context:
                              candidateType: host
                              protocol: udp
                        flushReason:
                          type: call-end
                        segment: 0
                        user_id: 3307ca65-df56-4f15-8ba7-589d584d215b
                        organization_id: 06a3dfbd-4988-4fb1-8d28-9b5d85ca624b
                    meta:
                      total_pages: 1
                      total_results: 1
                      page_number: 1
                      page_size: 20
        '400':
          description: Bad request — invalid pagination or sort parameter.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VoiceSdkCallReportV2ErrorResponse'
        '401':
          description: Authentication failed.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VoiceSdkCallReportV2ErrorResponse'
        '500':
          description: Unexpected server error while listing reports.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VoiceSdkCallReportV2ErrorResponse'
      security:
        - bearerAuth: []
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            // Automatically fetches more pages as needed.

            for await (const voiceSDKCallReportListResponse of
            client.voiceSDKCallReports.list()) {
              console.log(voiceSDKCallReportListResponse.call_id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.voice_sdk_call_reports.list()
            page = page.data[0]
            print(page.call_id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.VoiceSDKCallReports.List(context.TODO(), telnyx.VoiceSDKCallReportListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.voicesdkcallreports.VoiceSdkCallReportListPage;

            import
            com.telnyx.sdk.models.voicesdkcallreports.VoiceSdkCallReportListParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    VoiceSdkCallReportListPage page = client.voiceSdkCallReports().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.voice_sdk_call_reports.list

            puts(page)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $page = $client->voiceSDKCallReports->list(
                pageNumber: 0, pageSize: 0, sort: '-created_at'
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx voice-sdk-call-reports list \
              --api-key 'My API Key'
components:
  parameters:
    voice-sdk-debug_PageConsolidated:
      name: page
      in: query
      description: Consolidated page parameter (deepObject style).
      required: false
      style: deepObject
      explode: true
      schema:
        type: object
        properties:
          number:
            type: integer
            minimum: 1
            default: 1
            example: 1
          size:
            type: integer
            minimum: 1
            default: 20
            example: 20
            maximum: 100
            description: Number of reports per page. Maximum 100.
    VoiceSdkCallReportSort:
      name: sort
      in: query
      description: >-
        Set the order of the results by creation date. `asc` and `created_at`
        sort oldest reports first; `desc` and `-created_at` sort newest reports
        first. If not given, results are sorted by creation date in descending
        order.
      required: false
      schema:
        type: string
        enum:
          - asc
          - desc
          - created_at
          - '-created_at'
        default: desc
        example: '-created_at'
  schemas:
    VoiceSdkCallReportListResponse:
      type: object
      description: >-
        Paginated raw Voice SDK call report stats payloads as stored by
        voice-sdk-debug.
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/VoiceSdkCallReport'
        meta:
          $ref: '#/components/schemas/voice-sdk-debug_PaginationMeta'
      required:
        - data
        - meta
    VoiceSdkCallReportV2ErrorResponse:
      type: object
      description: Standard Telnyx API v2 error response envelope.
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/VoiceSdkCallReportV2Error'
      required:
        - errors
      additionalProperties: true
    VoiceSdkCallReport:
      type: object
      description: >-
        A raw call report stats JSON payload. The schema is intentionally
        permissive because Voice SDK clients can add fields over time.
      properties:
        call_id:
          type: string
          format: uuid
          description: Unique call identifier.
        call_report_id:
          type: string
          description: >-
            User-scoped storage grouping identifier derived from the
            authenticated user. This is not a unique per-call report identifier
            and may be shared by multiple calls for the same user.
        user_id:
          type: string
          format: uuid
          description: Authenticated user that owns the call report.
        organization_id:
          type: string
          format: uuid
          description: >-
            Organization associated with the stored call report when provided by
            the Voice SDK reporting path.
        voice_sdk_id:
          type: string
          description: Voice SDK instance identifier.
        voice_sdk_session_id:
          type: string
          description: >-
            Voice SDK session correlation identifier used to group stats
            segments for the same SDK session.
        voice_sdk_id_decoded:
          type: object
          additionalProperties: true
          description: >-
            Decoded Voice SDK identifier metadata emitted by voice-sdk-proxy
            when available.
        user_agent:
          type: string
          description: >-
            Voice SDK user agent string reported by the client. This is the
            preferred SDK/platform/version dimension when present.
        version:
          type: string
          description: >-
            Legacy SDK version value when the client reports one separately from
            the user agent.
        telnyx_session_id:
          type: string
          description: >-
            Telnyx RTC session identifier for correlating the report with Voice
            SDK signaling and media-session logs.
        telnyx_leg_id:
          type: string
          description: >-
            Telnyx call leg identifier for correlating the report with
            call-control, SIP, and media troubleshooting data.
        summary:
          type: object
          additionalProperties: true
          description: High-level call metadata.
        stats:
          $ref: '#/components/schemas/VoiceSdkCallReportStats'
        logs:
          $ref: '#/components/schemas/VoiceSdkCallReportLogs'
        flushReason:
          type: object
          additionalProperties: true
          description: >-
            Reason the SDK flushed this stats report segment, for example an
            intermediate socket-close flush.
        segment:
          type: integer
          description: >-
            Zero-based stats segment index when the SDK sends segmented or
            intermediate reports.
        stored_at:
          type: string
          format: date-time
          description: Time when the call report was stored.
        created_at:
          type: string
          format: date-time
          description: Creation timestamp when present.
      additionalProperties: true
    voice-sdk-debug_PaginationMeta:
      type: object
      title: Pagination Meta
      properties:
        total_pages:
          type: integer
          example: 1
        total_results:
          type: integer
          example: 1
        page_number:
          type: integer
          example: 1
        page_size:
          type: integer
          example: 20
    VoiceSdkCallReportV2Error:
      type: object
      description: Standard Telnyx API v2 error object.
      properties:
        code:
          type: string
          description: Telnyx error code.
          example: '10015'
        title:
          type: string
          description: Short, human-readable error title.
          example: Bad Request
        detail:
          type: string
          description: Human-readable details about the error.
          example: 'Missing required query parameter: call_id.'
        source:
          type: object
          description: Reference to the request field that caused the error.
          properties:
            parameter:
              type: string
              description: Query parameter that caused the error.
              example: call_id
            pointer:
              type: string
              description: JSON pointer to the request body field that caused the error.
          additionalProperties: true
        meta:
          type: object
          description: Additional error metadata.
          additionalProperties: true
          properties:
            url:
              type: string
              format: uri
              description: Link to error documentation.
              example: https://developers.telnyx.com/docs/overview/errors/10015
      required:
        - code
        - title
        - detail
      additionalProperties: true
    VoiceSdkCallReportStats:
      description: >-
        Raw stats payload emitted by the Voice SDK and stored without
        normalization. The exact shape can vary by SDK platform and version.
        Live responses commonly return an array of interval snapshots, but
        object-shaped stats payloads are also allowed for compatibility.
      oneOf:
        - type: array
          description: Raw interval stats snapshots emitted by the Voice SDK.
          items:
            type: object
            additionalProperties: true
            description: >-
              Raw stats snapshot. It may include WebRTC RTCStatsReport-style
              entries and audio, connection, ICE, or transport metrics.
        - type: object
          description: Raw stats object emitted by the Voice SDK.
          properties:
            audio:
              type: object
              additionalProperties: true
              description: >-
                Raw audio stats such as inbound/outbound packet, byte, jitter,
                packet-loss, bitrate, and audio-level metrics.
            connection:
              type: object
              additionalProperties: true
              description: >-
                Raw connection stats such as round-trip time, packets, and bytes
                sent or received.
            ice:
              type: object
              additionalProperties: true
              description: >-
                Raw ICE candidate-pair information, including selected pair,
                local/remote candidates, state, and nomination data when
                provided by the SDK.
            transport:
              type: object
              additionalProperties: true
              description: >-
                Raw transport stats such as ICE state, DTLS state, SRTP cipher,
                TLS version, and selected-candidate-pair changes.
          additionalProperties: true
    VoiceSdkCallReportLogs:
      description: >-
        Raw logs payload emitted by the Voice SDK and stored without
        normalization. Live responses commonly return an array of log entries,
        but object-shaped log payloads are also allowed for compatibility.
      oneOf:
        - type: array
          description: Raw log entries emitted by the Voice SDK.
          items:
            $ref: '#/components/schemas/VoiceSdkCallReportLogEntry'
        - type: object
          description: >-
            Raw logs object emitted by the Voice SDK when logs are grouped under
            an entries field.
          properties:
            entries:
              type: array
              description: Raw log entries when the SDK groups logs under an entries field.
              items:
                $ref: '#/components/schemas/VoiceSdkCallReportLogEntry'
          additionalProperties: true
    VoiceSdkCallReportLogEntry:
      type: object
      description: >-
        A raw Voice SDK log entry. Additional SDK-specific fields may be
        present.
      properties:
        timestamp:
          type: string
          format: date-time
          description: Time when the log entry was emitted.
        level:
          type: string
          description: Log level emitted by the SDK.
          enum:
            - debug
            - info
            - warn
            - error
        message:
          type: string
          description: Log message.
        context:
          type: object
          additionalProperties: true
          description: Raw structured context attached to the log entry.
      additionalProperties: true
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
