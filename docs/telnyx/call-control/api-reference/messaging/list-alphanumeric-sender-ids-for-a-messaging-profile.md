---
title: "List alphanumeric sender IDs for a messaging profile"
source_url: "https://developers.telnyx.com/api-reference/messaging/list-alphanumeric-sender-ids-for-a-messaging-profile.md"
category: "messaging"
synced_at: "2026-06-25T18:43:34.246Z"
content_hash: "09d3429a3e389f0a85c25b26fced20dc9cb4d61628576d08ccbc3a39f41cd444"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List alphanumeric sender IDs for a messaging profile

> List all alphanumeric sender IDs associated with a specific messaging profile.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/messaging/profiles.yml get /messaging/profiles/{id}/alphanumeric/sender/ids
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
  /messaging/profiles/{id}/alphanumeric/sender/ids:
    get:
      tags:
        - Messaging
      summary: List alphanumeric sender IDs for a messaging profile
      description: >-
        List all alphanumeric sender IDs associated with a specific messaging
        profile.
      operationId: ListProfileAlphanumericSenderIds
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: The identifier of the messaging profile.
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
          description: Successful response with a list of alphanumeric sender IDs.
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/AlphanumericSenderId'
                  meta:
                    $ref: '#/components/schemas/messaging_PaginationMeta'
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


            // Automatically fetches more pages as needed.

            for await (const alphanumericSenderID of
            client.messagingProfiles.listAlphanumericSenderIDs(
              '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
            )) {
              console.log(alphanumericSenderID.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.messaging_profiles.list_alphanumeric_sender_ids(
                id="182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e",
            )
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.MessagingProfiles.ListAlphanumericSenderIDs(\n\t\tcontext.TODO(),\n\t\t\"182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e\",\n\t\ttelnyx.MessagingProfileListAlphanumericSenderIDsParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.messagingprofiles.MessagingProfileListAlphanumericSenderIdsPage;

            import
            com.telnyx.sdk.models.messagingprofiles.MessagingProfileListAlphanumericSenderIdsParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    MessagingProfileListAlphanumericSenderIdsPage page = client.messagingProfiles().listAlphanumericSenderIds("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            page =
            telnyx.messaging_profiles.list_alphanumeric_sender_ids("182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e")


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
              $page = $client->messagingProfiles->listAlphanumericSenderIDs(
                '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e', pageNumber: 0, pageSize: 0
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx messaging-profiles list-alphanumeric-sender-ids \
              --api-key 'My API Key' \
              --id 182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e
components:
  schemas:
    AlphanumericSenderId:
      type: object
      properties:
        record_type:
          type: string
          enum:
            - alphanumeric_sender_id
          example: alphanumeric_sender_id
        id:
          type: string
          format: uuid
          description: Uniquely identifies the alphanumeric sender ID resource.
          example: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
        alphanumeric_sender_id:
          type: string
          description: The alphanumeric sender ID string.
          example: MyCompany
        organization_id:
          type: string
          description: The organization that owns this sender ID.
        messaging_profile_id:
          type: string
          format: uuid
          description: The messaging profile this sender ID belongs to.
        us_long_code_fallback:
          type: string
          description: >-
            A US long code number to use as fallback when sending to US
            destinations.
          example: '+15551234567'
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
