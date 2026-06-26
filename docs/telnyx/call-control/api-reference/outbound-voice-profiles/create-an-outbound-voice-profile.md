---
title: "Create an outbound voice profile"
source_url: "https://developers.telnyx.com/api-reference/outbound-voice-profiles/create-an-outbound-voice-profile.md"
category: "call-control"
synced_at: "2026-06-25T18:43:25.165Z"
content_hash: "7295ab815fdde09feb7251ca98fe15f136feda58accb23504f6bc0a0b6d87355"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Create an outbound voice profile

> Create an outbound voice profile.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/outbound-voice-profiles.yml post /outbound_voice_profiles
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
    post:
      tags:
        - Outbound Voice Profiles
      summary: Create an outbound voice profile
      description: Create an outbound voice profile.
      operationId: CreateVoiceProfile
      requestBody:
        description: Parameters that can be defined when creating an outbound voice profile
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOutboundVoiceProfileRequest'
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                title: Outbound Voice Profile Response
                properties:
                  data:
                    $ref: '#/components/schemas/OutboundVoiceProfile'
        '401':
          description: Unauthorized
        '404':
          description: Resource not found
        '422':
          description: Bad request
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const outboundVoiceProfile = await
            client.outboundVoiceProfiles.create({ name: 'office' });


            console.log(outboundVoiceProfile.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            outbound_voice_profile = client.outbound_voice_profiles.create(
                name="office",
            )
            print(outbound_voice_profile.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\toutboundVoiceProfile, err := client.OutboundVoiceProfiles.New(context.TODO(), telnyx.OutboundVoiceProfileNewParams{\n\t\tName: \"office\",\n\t})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", outboundVoiceProfile.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.outboundvoiceprofiles.OutboundVoiceProfileCreateParams;

            import
            com.telnyx.sdk.models.outboundvoiceprofiles.OutboundVoiceProfileCreateResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    OutboundVoiceProfileCreateParams params = OutboundVoiceProfileCreateParams.builder()
                        .name("office")
                        .build();
                    OutboundVoiceProfileCreateResponse outboundVoiceProfile = client.outboundVoiceProfiles().create(params);
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            outbound_voice_profile = telnyx.outbound_voice_profiles.create(name:
            "office")


            puts(outbound_voice_profile)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;

            use Telnyx\OutboundVoiceProfiles\ServicePlan;

            use Telnyx\OutboundVoiceProfiles\TrafficType;

            use Telnyx\OutboundVoiceProfiles\UsagePaymentMethod;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $outboundVoiceProfile = $client->outboundVoiceProfiles->create(
                name: 'office',
                billingGroupID: '6a09cdc3-8948-47f0-aa62-74ac943d6c58',
                callRecording: [
                  'callRecordingCallerPhoneNumbers' => ['+19705555098'],
                  'callRecordingChannels' => 'dual',
                  'callRecordingFormat' => 'mp3',
                  'callRecordingType' => 'by_caller_phone_number',
                ],
                callingWindow: [
                  'callsPerCld' => 5,
                  'endTime' => '20:00:00.00Z',
                  'startTime' => '08:00:00.00Z',
                ],
                concurrentCallLimit: 10,
                dailySpendLimit: '100.00',
                dailySpendLimitEnabled: true,
                enabled: true,
                maxDestinationRate: 10,
                servicePlan: ServicePlan::GLOBAL,
                tags: ['office-profile'],
                trafficType: TrafficType::CONVERSATIONAL,
                usagePaymentMethod: UsagePaymentMethod::RATE_DECK,
                whitelistedDestinations: ['US', 'BR', 'AU'],
              );

              var_dump($outboundVoiceProfile);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx outbound-voice-profiles create \
              --api-key 'My API Key' \
              --name office
components:
  schemas:
    CreateOutboundVoiceProfileRequest:
      type: object
      title: Outbound Voice Profile
      required:
        - name
      example:
        name: office
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
        billing_group_id: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
        calling_window:
          start_time: 08:00:00.00Z
          end_time: 20:00:00.00Z
          calls_per_cld: 5
      properties:
        name:
          type: string
          description: A user-supplied name to help with organization.
          example: office
          minLength: 3
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
              format: time
            end_time:
              type: string
              description: >-
                (BETA) The UTC time of day (in HH:MM format, 24-hour clock) when
                calls are no longer allowed to start.
              example: 20:00:00.00Z
              format: time
            calls_per_cld:
              type: integer
              description: >-
                (BETA) The maximum number of calls that can be initiated to a
                single called party (CLD) within the calling window. A null
                value means no limit.
              example: 5
              minimum: 0
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
