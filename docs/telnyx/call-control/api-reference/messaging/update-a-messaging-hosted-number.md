---
title: "Update a messaging hosted number"
source_url: "https://developers.telnyx.com/api-reference/messaging/update-a-messaging-hosted-number.md"
category: "messaging"
synced_at: "2026-06-25T18:43:34.961Z"
content_hash: "c497044a020779454c017f6b3340590e78cbe04ca95c0f2c612640bf906f7a19"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Update a messaging hosted number

> Update the messaging settings for a hosted number.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/messaging/hosted-numbers.yml patch /messaging_hosted_numbers/{id}
openapi: 3.1.0
info:
  title: Telnyx Messaging Hosted Numbers API
  version: 2.0.0
  description: API for messaging hosted number orders.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /messaging_hosted_numbers/{id}:
    patch:
      tags:
        - Messaging
      summary: Update a messaging hosted number
      description: Update the messaging settings for a hosted number.
      operationId: UpdateMessagingHostedNumber
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: The ID or phone number of the hosted number.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdatePhoneNumberMessagingSettingsRequest'
      responses:
        '200':
          description: Successful response with the updated hosted number.
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/PhoneNumberWithMessagingSettings'
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


            const messagingHostedNumber = await
            client.messagingHostedNumbers.update('id');


            console.log(messagingHostedNumber.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            messaging_hosted_number = client.messaging_hosted_numbers.update(
                id="id",
            )
            print(messaging_hosted_number.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tmessagingHostedNumber, err := client.MessagingHostedNumbers.Update(\n\t\tcontext.TODO(),\n\t\t\"id\",\n\t\ttelnyx.MessagingHostedNumberUpdateParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", messagingHostedNumber.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.messaginghostednumbers.MessagingHostedNumberUpdateParams;

            import
            com.telnyx.sdk.models.messaginghostednumbers.MessagingHostedNumberUpdateResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    MessagingHostedNumberUpdateResponse messagingHostedNumber = client.messagingHostedNumbers().update("id");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            messaging_hosted_number =
            telnyx.messaging_hosted_numbers.update("id")


            puts(messaging_hosted_number)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $messagingHostedNumber = $client->messagingHostedNumbers->update(
                'id',
                messagingProduct: 'P2P',
                messagingProfileID: 'dd50eba1-a0c0-4563-9925-b25e842a7cb6',
                tags: ['string'],
              );

              var_dump($messagingHostedNumber);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx messaging-hosted-numbers update \
              --api-key 'My API Key' \
              --id id
components:
  schemas:
    UpdatePhoneNumberMessagingSettingsRequest:
      type: object
      properties:
        messaging_profile_id:
          type: string
          description: >-
            Configure the messaging profile this phone number is assigned to:


            * Omit this field or set its value to `null` to keep the current
            value.

            * Set this field to `""` to unassign the number from its messaging
            profile

            * Set this field to a quoted UUID of a messaging profile to assign
            this number to that messaging profile
        messaging_product:
          type: string
          description: >-
            Configure the messaging product for this number:


            * Omit this field or set its value to `null` to keep the current
            value.

            * Set this field to a quoted product ID to set this phone number to
            that product
          example: P2P
        tags:
          type: array
          items:
            type: string
          description: Tags to set on this phone number.
      example:
        messaging_profile_id: dd50eba1-a0c0-4563-9925-b25e842a7cb6
        messaging_product: P2P
    PhoneNumberWithMessagingSettings:
      type: object
      example:
        record_type: messaging_settings
        id: '1293384261075731499'
        phone_number: '+18005550001'
        messaging_profile_id: 3fa85f64-5717-4562-b3fc-2c963f66afa6
        created_at: '2019-01-23T18:10:02.574Z'
        updated_at: '2019-01-23T18:10:02.574Z'
        country_code: US
        type: tollfree
        health:
          message_count: 122
          inbound_outbound_ratio: 0.43
          success_ratio: 0.94
          spam_ratio: 0.06
        eligible_messaging_products:
          - A2P
        traffic_type: A2P
        messaging_product: A2P
        features:
          sms:
            domestic_two_way: true
            international_inbound: true
            international_outbound: true
          mms: null
      properties:
        record_type:
          type: string
          example: messaging_settings
          enum:
            - messaging_phone_number
            - messaging_settings
          description: Identifies the type of the resource.
          readOnly: true
        id:
          type: string
          description: Identifies the type of resource.
          readOnly: true
        phone_number:
          type: string
          description: +E.164 formatted phone number.
          readOnly: true
          x-format: e164
        messaging_profile_id:
          type:
            - string
            - 'null'
          description: Unique identifier for a messaging profile.
        created_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was created.
          readOnly: true
        updated_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was updated.
          readOnly: true
        country_code:
          type: string
          description: ISO 3166-1 alpha-2 country code.
          pattern: ^[A-Z]{2}$
          example: US
          readOnly: true
        type:
          type: string
          description: The type of the phone number
          enum:
            - long-code
            - toll-free
            - short-code
            - longcode
            - tollfree
            - shortcode
          readOnly: true
        health:
          $ref: '#/components/schemas/NumberHealthMetrics'
        eligible_messaging_products:
          type: array
          description: The messaging products that this number can be registered to use
          readOnly: true
          items:
            type: string
        traffic_type:
          type: string
          description: >-
            The messaging traffic or use case for which the number is currently
            configured.
          example: P2P
          readOnly: true
        messaging_product:
          type: string
          description: The messaging product that the number is registered to use
          example: P2P
        features:
          type: object
          readOnly: true
          properties:
            sms:
              $ref: '#/components/schemas/MessagingFeatureSet'
            mms:
              $ref: '#/components/schemas/MessagingFeatureSet'
        organization_id:
          type: string
          description: The organization that owns this phone number.
        tags:
          type: array
          items:
            type: string
          description: Tags associated with this phone number.
    NumberHealthMetrics:
      type: object
      required:
        - message_count
        - inbound_outbound_ratio
        - success_ratio
        - spam_ratio
      description: >
        High level health metrics about the number and it's messaging sending
        patterns.
      properties:
        message_count:
          type: integer
          description: The number of messages analyzed for the health metrics.
        inbound_outbound_ratio:
          type: number
          format: float
          description: The ratio of messages received to the number of messages sent.
        success_ratio:
          type: number
          format: float
          description: >-
            The ratio of messages sucessfully delivered to the number of
            messages attempted.
        spam_ratio:
          type: number
          format: float
          description: >-
            The ratio of messages blocked for spam to the number of messages
            attempted.
      example:
        message_count: 10
        inbound_outbound_ratio: 1
        success_ratio: 2
        spam_ratio: 10
    MessagingFeatureSet:
      type:
        - object
        - 'null'
      required:
        - domestic_two_way
        - international_inbound
        - international_outbound
      description: >
        The set of features available for a specific messaging use case (SMS or
        MMS). Features

        can vary depending on the characteristics the phone number, as well as
        its current

        product configuration.
      properties:
        domestic_two_way:
          type: boolean
          description: >-
            Send messages to and receive messages from numbers in the same
            country.
        international_inbound:
          type: boolean
          description: Receive messages from numbers in other countries.
        international_outbound:
          type: boolean
          description: Send messages to numbers in other countries.
      example:
        domestic_two_way: true
        international_inbound: false
        international_outbound: true
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
