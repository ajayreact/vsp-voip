---
title: "Regenerate messaging profile secret"
source_url: "https://developers.telnyx.com/api-reference/messaging/regenerate-messaging-profile-secret.md"
category: "messaging"
synced_at: "2026-06-25T18:43:33.979Z"
content_hash: "76e34bbd7f329931ac100ec63563145d5b4a3a396059a21b5444381df3893577"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Regenerate messaging profile secret

> Regenerate the v1 secret for a messaging profile.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/messaging/profiles.yml post /messaging/profiles/{id}/actions/regenerate/secret
openapi: 3.1.0
info:
  title: Telnyx Messaging Profiles API
  version: 2.0.0
  description: API for messaging profiles and auto-response configurations.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /messaging/profiles/{id}/actions/regenerate/secret:
    post:
      tags:
        - Messaging
      summary: Regenerate messaging profile secret
      description: Regenerate the v1 secret for a messaging profile.
      operationId: RegenerateMessagingProfileSecret
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: The identifier of the messaging profile.
      responses:
        '200':
          description: Successful response with details about a messaging profile.
          content:
            application/json:
              schema:
                type: object
                title: Messaging Profile Response
                properties:
                  data:
                    $ref: '#/components/schemas/MessagingProfile'
        '401':
          $ref: '#/components/responses/messaging_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/messaging_NotFoundResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const response = await
            client.messagingProfiles.actions.regenerateSecret(
              '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
            );


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.messaging_profiles.actions.regenerate_secret(
                "182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.MessagingProfiles.Actions.RegenerateSecret(context.TODO(), \"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.messagingprofiles.actions.ActionRegenerateSecretParams;

            import
            com.telnyx.sdk.models.messagingprofiles.actions.ActionRegenerateSecretResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionRegenerateSecretResponse response = client.messagingProfiles().actions().regenerateSecret("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response =
            telnyx.messaging_profiles.actions.regenerate_secret("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


            puts(response)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $response = $client->messagingProfiles->actions->regenerateSecret(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e'
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx messaging-profiles:actions regenerate-secret \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
  schemas:
    MessagingProfile:
      type: object
      properties:
        record_type:
          description: Identifies the type of the resource.
          type: string
          enum:
            - messaging_profile
          readOnly: true
        id:
          description: Identifies the type of resource.
          type: string
          format: uuid
          readOnly: true
        mms_fall_back_to_sms:
          description: enables SMS fallback for MMS messages.
          type: boolean
          default: false
        mms_transcoding:
          description: enables automated resizing of MMS media.
          type: boolean
          default: false
        name:
          description: A user friendly name for the messaging profile.
          type: string
        enabled:
          description: Specifies whether the messaging profile is enabled or not.
          type: boolean
        webhook_url:
          description: >-
            The URL where webhooks related to this messaging profile will be
            sent.
          type:
            - string
            - 'null'
          format: url
        webhook_failover_url:
          description: >-
            The failover URL where webhooks related to this messaging profile
            will be sent if sending to the primary URL fails.
          type:
            - string
            - 'null'
          format: url
        webhook_api_version:
          description: >-
            Determines which webhook format will be used, Telnyx API v1, v2, or
            a legacy 2010-04-01 format.
          type: string
          enum:
            - '1'
            - '2'
            - '2010-04-01'
        health_webhook_url:
          description: 'DEPRECATED: health check url service checking'
          type:
            - string
            - 'null'
          format: url
        whitelisted_destinations:
          description: >-
            Destinations to which the messaging profile is allowed to send. The
            elements in the list must be valid ISO 3166-1 alpha-2 country codes.
            If set to `["*"]`, all destinations will be allowed.
          type: array
          items:
            description: ISO 3166-1 alpha-2 country code.
            type: string
            pattern: ^[A-Z]{2}$
        created_at:
          description: ISO 8601 formatted date indicating when the resource was created.
          type: string
          format: date-time
          readOnly: true
        updated_at:
          description: ISO 8601 formatted date indicating when the resource was updated.
          type: string
          format: date-time
          readOnly: true
        v1_secret:
          description: Secret used to authenticate with v1 endpoints.
          type: string
        number_pool_settings:
          $ref: '#/components/schemas/NumberPoolSettings'
        url_shortener_settings:
          $ref: '#/components/schemas/UrlShortenerSettings'
        alpha_sender:
          description: >-
            The alphanumeric sender ID to use when sending to destinations that
            require an alphanumeric sender ID.
          type:
            - string
            - 'null'
          pattern: ^[A-Za-z0-9 ]{1,11}$
        daily_spend_limit:
          description: >-
            The maximum amount of money (in USD) that can be spent by this
            profile before midnight UTC.
          type: string
          pattern: ^[0-9]+(?:\.[0-9]+)?$
        daily_spend_limit_enabled:
          description: Whether to enforce the value configured by `daily_spend_limit`.
          type: boolean
        redaction_enabled:
          description: >-
            Indicates whether message content redaction is enabled for this
            profile.
          type: boolean
          default: false
        redaction_level:
          description: >-
            Determines how much information is redacted in messages for privacy
            or compliance purposes.
          type: integer
          default: 2
        mobile_only:
          description: Send messages only to mobile phone numbers.
          type: boolean
          default: false
        smart_encoding:
          description: >-
            Enables automatic character encoding optimization for SMS messages.
            When enabled, the system automatically selects the most efficient
            encoding (GSM-7 or UCS-2) based on message content to maximize
            character limits and minimize costs.
          type: boolean
          default: false
        organization_id:
          type: string
          description: The organization that owns this messaging profile.
        ai_assistant_id:
          type:
            - string
            - 'null'
          description: The AI assistant ID associated with this messaging profile.
        resource_group_id:
          type:
            - string
            - 'null'
          description: The resource group ID associated with this messaging profile.
      example:
        record_type: messaging_profile
        id: 3fa85f64-5717-4562-b3fc-2c963f66afa6
        name: Profile for Messages
        webhook_url: https://www.example.com/hooks
        webhook_failover_url: https://backup.example.com/hooks
        enabled: true
        webhook_api_version: '2'
        whitelisted_destinations:
          - US
        created_at: '2019-01-23T18:10:02.574Z'
        updated_at: '2019-01-23T18:10:02.574Z'
        number_pool_settings:
          toll_free_weight: 10
          long_code_weight: 2
          skip_unhealthy: false
          sticky_sender: true
          geomatch: false
        url_shortener_settings:
          domain: example.ex
          prefix: cmpny
          replace_blacklist_only: true
          send_webhooks: false
        v1_secret: rP1VamejkU2v0qIUxntqLW2c
        health_webhook_url: null
        mms_fall_back_to_sms: false
        mms_transcoding: false
        daily_spend_limit: '100.00'
        daily_spend_limit_enabled: false
        redaction_enabled: false
        redaction_level: 2
        mobile_only: false
    NumberPoolSettings:
      type:
        - object
        - 'null'
      required:
        - toll_free_weight
        - long_code_weight
        - skip_unhealthy
      description: >
        Number Pool allows you to send messages from a pool of numbers of
        different types, assigning

        weights to each type. The pool consists of all the long code and toll
        free numbers

        assigned to the messaging profile.


        To disable this feature, set the object field to `null`.
      properties:
        toll_free_weight:
          type: number
          example: 10
          description: >
            Defines the probability weight for a Toll Free number to be selected
            when sending a message.

            The higher the weight the higher the probability. The sum of the
            weights for all number types

            does not necessarily need to add to 100. Weight must be a
            non-negative number, and when equal

            to zero it will remove the number type from the pool.
        long_code_weight:
          type: number
          example: 1
          description: >
            Defines the probability weight for a Long Code number to be selected
            when sending a message.

            The higher the weight the higher the probability. The sum of the
            weights for all number types

            does not necessarily need to add to 100.  Weight must be a
            non-negative number, and when equal

            to zero it will remove the number type from the pool.
        skip_unhealthy:
          type: boolean
          example: true
          description: >
            If set to true all unhealthy numbers will be automatically excluded
            from the pool.

            Health metrics per number are calculated on a regular basis, taking
            into account the deliverability

            rate and the amount of messages marked as spam by upstream carriers.

            Numbers with a deliverability rate below 25% or spam ratio over 75%
            will be considered unhealthy.
        sticky_sender:
          type: boolean
          default: false
          description: >
            If set to true, Number Pool will try to choose the same sending
            number for all messages to a particular

            recipient. If the sending number becomes unhealthy and
            `skip_unhealthy` is set to true, a new

            number will be chosen.
        geomatch:
          type: boolean
          default: false
          description: >
            If set to true, Number Pool will try to choose a sending number with
            the same area code as the destination

            number. If there are no such numbers available, a nunber with a
            different area code will be chosen. Currently

            only NANP numbers are supported.
      example:
        toll_free_weight: 10
        long_code_weight: 1
        skip_unhealthy: true
        sticky_sender: false
        geomatch: false
    UrlShortenerSettings:
      type:
        - object
        - 'null'
      required:
        - domain
      description: >
        The URL shortener feature allows automatic replacement of URLs that were
        generated using

        a public URL shortener service. Some examples include bit.do, bit.ly,
        goo.gl, ht.ly,

        is.gd, ow.ly, rebrand.ly, t.co, tiny.cc, and tinyurl.com. Such URLs are
        replaced with

        with links generated by Telnyx. The use of custom links can improve
        branding and message

        deliverability.


        To disable this feature, set the object field to `null`.
      properties:
        domain:
          type: string
          example: acct.fyi
          description: |
            One of the domains provided by the Telnyx URL shortener service.
        prefix:
          type: string
          example: ''
          description: >
            Optional prefix that can be used to identify your brand, and will
            appear in the Telnyx generated URLs after the domain name.
        replace_blacklist_only:
          type: boolean
          example: true
          description: >
            Use the link replacement tool only for links that are specifically
            blacklisted by Telnyx.
        send_webhooks:
          type: boolean
          example: false
          description: >
            Receive webhooks for when your replaced links are clicked. Webhooks
            are sent to the webhooks on the messaging profile.
      example:
        domain: example.ex
        prefix: ''
        replace_blacklist_only: true
        send_webhooks: false
    messaging_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/messaging_Error'
    messaging_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          x-format: integer
        title:
          type: string
        detail:
          type: string
        source:
          type: object
          properties:
            pointer:
              description: JSON pointer (RFC6901) to the offending entity.
              type: string
              format: json-pointer
            parameter:
              description: Indicates which query parameter caused the error.
              type: string
        meta:
          type: object
  responses:
    messaging_UnauthorizedResponse:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/messaging_Errors'
    messaging_NotFoundResponse:
      description: Not Found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/messaging_Errors'
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
