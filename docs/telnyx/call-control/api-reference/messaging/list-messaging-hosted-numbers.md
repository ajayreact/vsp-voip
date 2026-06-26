---
title: "List messaging hosted numbers"
source_url: "https://developers.telnyx.com/api-reference/messaging/list-messaging-hosted-numbers.md"
category: "messaging"
synced_at: "2026-06-25T18:43:35.220Z"
content_hash: "e4d960ebd59ca0a72694810db8e0242aca51f1c6addb3dc2ece4dc71b724acaf"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List messaging hosted numbers

> List all hosted numbers associated with the authenticated user.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/messaging/hosted-numbers.yml get /messaging/hosted/numbers
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
  /messaging/hosted/numbers:
    get:
      tags:
        - Messaging
      summary: List messaging hosted numbers
      description: List all hosted numbers associated with the authenticated user.
      operationId: ListMessagingHostedNumbers
      parameters:
        - name: filter[messaging_profile_id]
          in: query
          required: false
          schema:
            type: string
            format: uuid
          description: Filter by messaging profile ID.
        - name: filter[phone_number]
          in: query
          required: false
          schema:
            type: string
          description: Filter by exact phone number.
        - name: filter[phone_number][contains]
          in: query
          required: false
          schema:
            type: string
          description: Filter by phone number substring.
        - name: sort[phone_number]
          in: query
          required: false
          schema:
            type: string
            enum:
              - asc
              - desc
          description: Sort by phone number.
        - name: page[number]
          in: query
          description: Page number to retrieve (1-based).
          required: false
          schema:
            type: integer
            default: 1
        - name: page[size]
          in: query
          description: Number of items to return per page.
          required: false
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Successful response with a list of hosted numbers.
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PhoneNumberWithMessagingSettings'
                  meta:
                    $ref: '#/components/schemas/messaging_PaginationMeta'
        '401':
          $ref: '#/components/responses/messaging_UnauthorizedResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            // Automatically fetches more pages as needed.

            for await (const phoneNumberWithMessagingSettings of
            client.messagingHostedNumbers.list()) {
              console.log(phoneNumberWithMessagingSettings.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.messaging_hosted_numbers.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.MessagingHostedNumbers.List(context.TODO(), telnyx.MessagingHostedNumberListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.messaginghostednumbers.MessagingHostedNumberListPage;

            import
            com.telnyx.sdk.models.messaginghostednumbers.MessagingHostedNumberListParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    MessagingHostedNumberListPage page = client.messagingHostedNumbers().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.messaging_hosted_numbers.list

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
              $page = $client->messagingHostedNumbers->list(
                filterMessagingProfileID: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
                filterPhoneNumber: 'filter[phone_number]',
                filterPhoneNumberContains: 'filter[phone_number][contains]',
                pageNumber: 0,
                pageSize: 0,
                sortPhoneNumber: 'asc',
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx messaging-hosted-numbers list \
              --api-key 'My API Key'
components:
  schemas:
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
    messaging_PaginationMeta:
      type: object
      required:
        - total_pages
        - total_results
        - page_size
        - page_number
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
