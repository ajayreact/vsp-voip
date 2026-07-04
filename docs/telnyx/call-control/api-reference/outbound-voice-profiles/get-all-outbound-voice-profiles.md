---
title: "Get all outbound voice profiles"
source_url: "https://developers.telnyx.com/api-reference/outbound-voice-profiles/get-all-outbound-voice-profiles.md"
category: "call-control"
synced_at: "2026-06-25T18:43:24.913Z"
content_hash: "a1756c222f23bfa1946e9cb77180b9db9713d1349f976d7568cacdd54d3328c9"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Get all outbound voice profiles

> Get all outbound voice profiles belonging to the user that match the given filters.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/outbound-voice-profiles.yml get /outbound_voice_profiles
openapi: 3.1.0
info:
  title: Telnyx Outbound Voice Profiles API
  version: 2.0.0
  description: API for Outbound voice profiles.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /outbound_voice_profiles:
    get:
      tags:
        - Outbound Voice Profiles
      summary: Get all outbound voice profiles
      description: >-
        Get all outbound voice profiles belonging to the user that match the
        given filters.
      operationId: ListOutboundVoiceProfiles
      parameters:
        - $ref: '#/components/parameters/outbound-voice-profiles_PageConsolidated'
        - $ref: '#/components/parameters/outbound-voice-profiles_FilterConsolidated'
        - $ref: '#/components/parameters/SortOutboundVoiceProfile'
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                title: List Outbound Voice Profiles Response
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/OutboundVoiceProfile'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
        '401':
          description: Unauthorized
        '422':
          description: Bad request
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            // Automatically fetches more pages as needed.

            for await (const outboundVoiceProfile of
            client.outboundVoiceProfiles.list()) {
              console.log(outboundVoiceProfile.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.outbound_voice_profiles.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.OutboundVoiceProfiles.List(context.TODO(), telnyx.OutboundVoiceProfileListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.outboundvoiceprofiles.OutboundVoiceProfileListPage;

            import
            com.telnyx.sdk.models.outboundvoiceprofiles.OutboundVoiceProfileListParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    OutboundVoiceProfileListPage page = client.outboundVoiceProfiles().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.outbound_voice_profiles.list

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
              $page = $client->outboundVoiceProfiles->list(
                filter: ['name' => ['contains' => 'office-profile']],
                pageNumber: 0,
                pageSize: 0,
                sort: 'name',
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx outbound-voice-profiles list \
              --api-key 'My API Key'
components:
  parameters:
    outbound-voice-profiles_PageConsolidated:
      name: page
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated page parameter (deepObject style). Originally: page[size],
        page[number]
      schema:
        type: object
        properties:
          size:
            type: integer
            minimum: 1
            maximum: 250
            default: 20
            description: The size of the page.
          number:
            type: integer
            minimum: 1
            default: 1
            description: The page number to load.
    outbound-voice-profiles_FilterConsolidated:
      name: filter
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated filter parameter (deepObject style). Originally:
        filter[name][contains]
      schema:
        type: object
        properties:
          name:
            type: object
            properties:
              contains:
                type: string
                example: office-profile
                description: Optional filter on outbound voice profile name.
            description: Name filtering operations
    SortOutboundVoiceProfile:
      name: sort
      in: query
      description: >-
        Specifies the sort order for results. By default sorting direction is
        ascending. To have the results sorted in descending order add the
        <code>-</code> prefix.<br/><br/>

        That is: <ul>
          <li>
            <code>name</code>: sorts the result by the
            <code>name</code> field in ascending order.
          </li>

          <li>
            <code>-name</code>: sorts the result by the
            <code>name</code> field in descending order.
          </li>
        </ul> <br/>
      schema:
        type: string
        enum:
          - enabled
          - '-enabled'
          - created_at
          - '-created_at'
          - name
          - '-name'
          - service_plan
          - '-service_plan'
          - traffic_type
          - '-traffic_type'
          - usage_payment_method
          - '-usage_payment_method'
        default: '-created_at'
        example: name
  schemas:
    OutboundVoiceProfile:
      type: object
      title: Outbound Voice Profile
      required:
        - name
      example:
        id: '1293384261075731499'
        record_type: outbound_voice_profile
        name: office
        connections_count: 12
        traffic_type: conversational
        service_plan: global
        concurrent_call_limit: 10
        enabled: true
        tags:
          - office-profile
        usage_payment_method: rate-deck
        whitelisted_destinations:
          - US
          - BR
          - AU
        max_destination_rate: 10
        daily_spend_limit: '100.00'
        daily_spend_limit_enabled: true
        call_recording:
          call_recording_type: by_caller_phone_number
          call_recording_caller_phone_numbers:
            - '+19705555098'
          call_recording_channels: dual
          call_recording_format: mp3
        billing_group_id: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
        calling_window:
          start_time: 08:00:00.00Z
          end_time: 20:00:00.00Z
          calls_per_cld: 5
        created_at: '2018-02-02T22:25:27.521Z'
        updated_at: '2018-02-02T22:25:27.521Z'
      properties:
        id:
          type: string
          description: Identifies the resource.
          example: '1293384261075731499'
        record_type:
          type: string
          description: Identifies the type of the resource.
          example: outbound_voice_profile
        name:
          type: string
          description: A user-supplied name to help with organization.
          example: office
          minLength: 3
        connections_count:
          type: integer
          description: Amount of connections associated with this outbound voice profile.
          example: 12
        traffic_type:
          $ref: '#/components/schemas/TrafficType'
        service_plan:
          $ref: '#/components/schemas/ServicePlan'
        concurrent_call_limit:
          type:
            - integer
            - 'null'
          description: >-
            Must be no more than your global concurrent call limit. Null means
            no limit.
          example: 10
        enabled:
          type: boolean
          description: >-
            Specifies whether the outbound voice profile can be used. Disabled
            profiles will result in outbound calls being blocked for the
            associated Connections.
          example: true
          default: true
        tags:
          type: array
          items:
            type: string
          example:
            - office-profile
        usage_payment_method:
          $ref: '#/components/schemas/UsagePaymentMethod'
        whitelisted_destinations:
          type: array
          items:
            type: string
          description: >-
            The list of destinations you want to be able to call using this
            outbound voice profile formatted in alpha2.
          example:
            - US
            - BR
            - AU
          default:
            - US
            - CA
        max_destination_rate:
          type: number
          description: >-
            Maximum rate (price per minute) for a Destination to be allowed when
            making outbound calls.
        daily_spend_limit:
          type: string
          description: >-
            The maximum amount of usage charges, in USD, you want Telnyx to
            allow on this outbound voice profile in a day before disallowing new
            calls.
          example: '100.00'
        daily_spend_limit_enabled:
          type: boolean
          description: >-
            Specifies whether to enforce the daily_spend_limit on this outbound
            voice profile.
          example: true
          default: false
        call_recording:
          $ref: '#/components/schemas/OutboundCallRecording'
        billing_group_id:
          type:
            - string
            - 'null'
          format: uuid
          description: >-
            The ID of the billing group associated with the outbound proflile.
            Defaults to null (for no group assigned).
          example: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
          default: null
        calling_window:
          type: object
          description: >-
            (BETA) Specifies the time window and call limits for calls made
            using this outbound voice profile. Note that all times are UTC in
            24-hour clock time.
          example:
            start_time: 08:00:00.00Z
            end_time: 20:00:00.00Z
            calls_per_cld: 5
          properties:
            start_time:
              type: string
              description: >-
                (BETA) The UTC time of day (in HH:MM format, 24-hour clock) when
                calls are allowed to start.
              example: 08:00:00.00Z
            end_time:
              type: string
              description: >-
                (BETA) The UTC time of day (in HH:MM format, 24-hour clock) when
                calls are no longer allowed to start.
              example: 20:00:00.00Z
            calls_per_cld:
              type: integer
              description: >-
                (BETA) The maximum number of calls that can be initiated to a
                single called party (CLD) within the calling window. A null
                value means no limit.
              example: 5
        created_at:
          type: string
          description: >-
            ISO 8601 formatted date-time indicating when the resource was
            created.
          example: '2018-02-02T22:25:27.521Z'
        updated_at:
          type: string
          description: >-
            ISO 8601 formatted date-time indicating when the resource was
            updated.
          example: '2018-02-02T22:25:27.521Z'
    PaginationMeta:
      type: object
      properties:
        total_pages:
          type: integer
          example: 3
        total_results:
          type: integer
          example: 55
        page_number:
          type: integer
          example: 2
        page_size:
          type: integer
          example: 25
    TrafficType:
      type: string
      description: Specifies the type of traffic allowed in this profile.
      enum:
        - conversational
      example: conversational
      default: conversational
    ServicePlan:
      type: string
      description: Indicates the coverage of the termination regions.
      enum:
        - global
      example: global
      default: global
    UsagePaymentMethod:
      type: string
      description: Setting for how costs for outbound profile are calculated.
      enum:
        - rate-deck
      example: rate-deck
      default: rate-deck
    OutboundCallRecording:
      type: object
      example:
        call_recording_type: by_caller_phone_number
        call_recording_caller_phone_numbers:
          - '+19705555098'
        call_recording_channels: dual
        call_recording_format: mp3
      properties:
        call_recording_type:
          type: string
          description: Specifies which calls are recorded.
          enum:
            - all
            - none
            - by_caller_phone_number
        call_recording_caller_phone_numbers:
          type: array
          items:
            type: string
          description: >-
            When call_recording_type is 'by_caller_phone_number', only outbound
            calls using one of these numbers will be recorded. Numbers must be
            specified in E164 format.
          example:
            - '+19705555098'
        call_recording_channels:
          type: string
          description: >-
            When using 'dual' channels, the final audio file will be a stereo
            recording with the first leg on channel A, and the rest on channel
            B.
          example: dual
          default: single
          enum:
            - single
            - dual
        call_recording_format:
          type: string
          description: The audio file format for calls being recorded.
          example: mp3
          default: wav
          enum:
            - wav
            - mp3
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
