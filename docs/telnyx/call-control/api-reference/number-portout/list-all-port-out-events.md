---
title: "List all port-out events"
source_url: "https://developers.telnyx.com/api-reference/number-portout/list-all-port-out-events.md"
category: "phone-numbers"
synced_at: "2026-06-25T18:43:32.227Z"
content_hash: "f053401bc6f0d99efb60d906c4239ac52b1b69eafbdf673bba59c3bd7ddf48fb"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List all port-out events

> Returns a list of all port-out events.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/numbers-identity/portout.yml get /portouts/events
openapi: 3.1.0
info:
  title: Telnyx Number Portout API
  version: 2.0.0
  description: API for Number portout.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /portouts/events:
    get:
      tags:
        - Number Portout
      summary: List all port-out events
      description: Returns a list of all port-out events.
      operationId: listPortoutEvents
      parameters:
        - $ref: '#/components/parameters/PageConsolidated'
        - name: filter
          in: query
          style: deepObject
          explode: true
          description: >-
            Consolidated filter parameter (deepObject style). Originally:
            filter[event_type], filter[portout_id], filter[created_at]
          schema:
            type: object
            properties:
              event_type:
                type: string
                enum:
                  - portout.status_changed
                  - portout.new_comment
                  - portout.foc_date_changed
                example: portout.status_changed
                description: Filter by event type.
              portout_id:
                type: string
                format: uuid
                example: 34dc46a9-53ed-4e01-9454-26227ea13326
                description: Filter by port-out order ID.
              created_at:
                type: object
                description: Filter by created_at date range using nested operations
                properties:
                  gte:
                    type: string
                    format: date-time
                    example: '2021-01-01T00:00:00Z'
                    description: Filter by created at greater than or equal to.
                  lte:
                    type: string
                    format: date-time
                    example: '2021-01-01T00:00:00Z'
                    description: Filter by created at less than or equal to.
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/PortoutEvent'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
        '422':
          description: Unprocessable entity. Check message field in response for details.
        '500':
          description: Internal server error
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            // Automatically fetches more pages as needed.

            for await (const eventListResponse of client.portouts.events.list())
            {
              console.log(eventListResponse);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.portouts.events.list()
            page = page.data[0]
            print(page)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.Portouts.Events.List(context.TODO(), telnyx.PortoutEventListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.portouts.events.EventListPage;
            import com.telnyx.sdk.models.portouts.events.EventListParams;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    EventListPage page = client.portouts().events().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.portouts.events.list

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
              $page = $client->portouts->events->list(
                filter: [
                  'createdAt' => [
                    'gte' => new \DateTimeImmutable('2021-01-01T00:00:00Z'),
                    'lte' => new \DateTimeImmutable('2021-01-01T00:00:00Z'),
                  ],
                  'eventType' => 'portout.status_changed',
                  'portoutID' => '34dc46a9-53ed-4e01-9454-26227ea13326',
                ],
                pageNumber: 0,
                pageSize: 0,
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx portouts:events list \
              --api-key 'My API Key'
components:
  parameters:
    PageConsolidated:
      name: page
      in: query
      style: deepObject
      explode: true
      description: >-
        Consolidated page parameter (deepObject style). Originally:
        page[number], page[size]
      schema:
        type: object
        properties:
          number:
            type: integer
            minimum: 1
            default: 1
            description: The page number to load
          size:
            type: integer
            minimum: 1
            maximum: 250
            default: 20
            description: The size of the page
  schemas:
    PortoutEvent:
      type: object
      oneOf:
        - $ref: '#/components/schemas/WebhookPortoutStatusChanged'
        - $ref: '#/components/schemas/WebhookPortoutNewComment'
        - $ref: '#/components/schemas/WebhookPortoutFocDateChanged'
      discriminator:
        propertyName: event_type
        mapping:
          portout.status_changed:
            $ref: '#/components/schemas/WebhookPortoutStatusChanged'
          portout.new_comment:
            $ref: '#/components/schemas/WebhookPortoutNewComment'
          portout.foc_date_changed:
            $ref: '#/components/schemas/WebhookPortoutFocDateChanged'
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
    WebhookPortoutStatusChanged:
      type: object
      properties:
        id:
          type: string
          description: Uniquely identifies the event.
          format: uuid
          example: eef3340b-8903-4466-b445-89b697315a3a
        event_type:
          type: string
          description: Identifies the event type
          enum:
            - portout.status_changed
            - portout.foc_date_changed
            - portout.new_comment
          example: portout.status_changed
        portout_id:
          type: string
          format: uuid
          description: Identifies the port-out order associated with the event.
          example: 9471c873-e3eb-4ca1-957d-f9a451334d52
        available_notification_methods:
          type: array
          items:
            type: string
            enum:
              - email
              - webhook
          description: Indicates the notification methods used.
        payload_status:
          type: string
          description: The status of the payload generation.
          enum:
            - created
            - completed
          example: created
        payload:
          type: object
          description: The webhook payload for the portout.status_changed event
          properties:
            id:
              type: string
              format: uuid
              example: 96dfa9e4-c753-4fd3-97cd-42d66f26cf0c
              description: Identifies the port out that was moved.
            status:
              type: string
              description: The new status of the port out.
              enum:
                - pending
                - authorized
                - ported
                - rejected
                - rejected-pending
                - canceled
              example: authorized
            phone_numbers:
              type: array
              description: Phone numbers associated with this port-out order
              items:
                type: string
                description: E164 formatted phone number
              example:
                - '+35312345678'
            carrier_name:
              type: string
              description: Carrier the number will be ported out to
              example: Testing Carrier
            spid:
              type: string
              description: The new carrier SPID.
              example: 987H
            user_id:
              type: string
              format: uuid
              description: Identifies the user that the port-out order belongs to.
              example: 96dfa9e4-c753-4fd3-97cd-42d66f26cf0c
            subscriber_name:
              type: string
              description: The name of the port-out's end user.
              example: John Doe
            rejection_reason:
              type:
                - string
                - 'null'
              description: >-
                The reason why the order is being rejected by the user. If the
                order is authorized, this field can be left null
              example: null
            attempted_pin:
              type: string
              description: The PIN that was attempted to be used to authorize the port out.
              example: '1234'
        record_type:
          type: string
          example: portout_event
          description: Identifies the type of the resource.
          readOnly: true
        created_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was created.
          example: '2021-03-19T10:07:15.527000Z'
        updated_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was updated.
          example: '2021-03-19T10:07:15.527000Z'
    WebhookPortoutNewComment:
      type: object
      properties:
        id:
          type: string
          description: Uniquely identifies the event.
          format: uuid
          example: eef3340b-8903-4466-b445-89b697315a3a
        event_type:
          type: string
          description: Identifies the event type
          enum:
            - portout.status_changed
            - portout.foc_date_changed
            - portout.new_comment
          example: portout.status_changed
        portout_id:
          type: string
          format: uuid
          description: Identifies the port-out order associated with the event.
          example: 9471c873-e3eb-4ca1-957d-f9a451334d52
        available_notification_methods:
          type: array
          items:
            type: string
            enum:
              - email
              - webhook
          description: Indicates the notification methods used.
        payload_status:
          type: string
          description: The status of the payload generation.
          enum:
            - created
            - completed
          example: created
        payload:
          type: object
          description: The webhook payload for the portout.new_comment event
          properties:
            id:
              type: string
              format: uuid
              example: 96dfa9e4-c753-4fd3-97cd-42d66f26cf0c
              description: Identifies the comment that was added to the port-out order.
            portout_id:
              type: string
              format: uuid
              example: d26109e5-0605-4671-a235-d3c649cc8406
              description: Identifies the port-out order that the comment was added to.
            user_id:
              type: string
              format: uuid
              example: 1c45c968-c2e0-4559-b1dd-db073962fc61
              description: Identifies the user that added the comment.
            comment:
              type: string
              description: The body of the comment.
              example: This is a comment.
        record_type:
          type: string
          example: portout_event
          description: Identifies the type of the resource.
          readOnly: true
        created_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was created.
          example: '2021-03-19T10:07:15.527000Z'
        updated_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was updated.
          example: '2021-03-19T10:07:15.527000Z'
    WebhookPortoutFocDateChanged:
      type: object
      properties:
        id:
          type: string
          description: Uniquely identifies the event.
          format: uuid
          example: eef3340b-8903-4466-b445-89b697315a3a
        event_type:
          type: string
          description: Identifies the event type
          enum:
            - portout.status_changed
            - portout.foc_date_changed
            - portout.new_comment
          example: portout.status_changed
        portout_id:
          type: string
          format: uuid
          description: Identifies the port-out order associated with the event.
          example: 9471c873-e3eb-4ca1-957d-f9a451334d52
        available_notification_methods:
          type: array
          items:
            type: string
            enum:
              - email
              - webhook
          description: Indicates the notification methods used.
        payload_status:
          type: string
          description: The status of the payload generation.
          enum:
            - created
            - completed
          example: created
        payload:
          type: object
          description: The webhook payload for the portout.foc_date_changed event
          properties:
            id:
              type: string
              format: uuid
              example: 96dfa9e4-c753-4fd3-97cd-42d66f26cf0c
              description: Identifies the port-out order that have the FOC date changed.
            user_id:
              type: string
              description: Identifies the organization that port-out order belongs to.
              example: 0e19c89e-f0ce-458a-a36c-3c60bc2014b1
            foc_date:
              type: string
              description: ISO 8601 formatted date indicating the new FOC date.
              example: '2021-03-19T10:07:15.527Z'
              format: date-time
        record_type:
          type: string
          example: portout_event
          description: Identifies the type of the resource.
          readOnly: true
        created_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was created.
          example: '2021-03-19T10:07:15.527000Z'
        updated_at:
          type: string
          format: date-time
          description: ISO 8601 formatted date indicating when the resource was updated.
          example: '2021-03-19T10:07:15.527000Z'
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
