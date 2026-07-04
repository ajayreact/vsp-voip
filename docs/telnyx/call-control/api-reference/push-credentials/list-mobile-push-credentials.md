---
title: "List mobile push credentials"
source_url: "https://developers.telnyx.com/api-reference/push-credentials/list-mobile-push-credentials.md"
category: "authentication"
synced_at: "2026-06-25T18:42:59.188Z"
content_hash: "a0009671a17e468cc6c880e782d15c51cfc5a7630e1d6255d8ed59cada4185da"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List mobile push credentials

> List mobile push credentials



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/mobile-push-credentials.yml get /mobile_push_credentials
openapi: 3.1.0
info:
  title: Telnyx Mobile Push Credentials API
  version: 2.0.0
  description: API for managing mobile push credentials for WebRTC.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /mobile_push_credentials:
    get:
      tags:
        - Push Credentials
      summary: List mobile push credentials
      description: List mobile push credentials
      operationId: ListPushCredentials
      parameters:
        - $ref: '#/components/parameters/push-notifications_PageConsolidated'
        - name: filter
          in: query
          style: deepObject
          explode: true
          description: >-
            Consolidated filter parameter (deepObject style). Originally:
            filter[type], filter[alias]
          schema:
            type: object
            properties:
              type:
                type: string
                enum:
                  - ios
                  - android
                example: ios
                description: type of mobile push credentials
              alias:
                type: string
                example: LucyCredential
                description: Unique mobile push credential alias
      responses:
        '200':
          description: Mobile mobile push credentials
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ListPushCredentialsResponse'
        '401':
          description: Unauthorized request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/push-notifications_Errors'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            // Automatically fetches more pages as needed.

            for await (const pushCredential of
            client.mobilePushCredentials.list()) {
              console.log(pushCredential.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.mobile_push_credentials.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.MobilePushCredentials.List(context.TODO(), telnyx.MobilePushCredentialListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.mobilepushcredentials.MobilePushCredentialListPage;

            import
            com.telnyx.sdk.models.mobilepushcredentials.MobilePushCredentialListParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    MobilePushCredentialListPage page = client.mobilePushCredentials().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.mobile_push_credentials.list

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
              $page = $client->mobilePushCredentials->list(
                filter: ['alias' => 'LucyCredential', 'type' => 'ios'],
                pageNumber: 0,
                pageSize: 0,
              );

              var_dump($page);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx mobile-push-credentials list \
              --api-key 'My API Key'
components:
  parameters:
    push-notifications_PageConsolidated:
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
  schemas:
    ListPushCredentialsResponse:
      description: Mobile mobile push credentials
      properties:
        data:
          type: array
          items:
            $ref: '#/components/schemas/PushCredential'
        meta:
          $ref: '#/components/schemas/PaginationMeta'
      type: object
    push-notifications_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/push-notifications_Error'
      type: object
    PushCredential:
      type: object
      title: Successful response with details about a push credential
      required:
        - id
        - certificate
        - private_key
        - project_account_json_file
        - alias
        - type
        - record_type
        - created_at
        - updated_at
      properties:
        id:
          description: Unique identifier of a push credential
          type: string
          example: 0ccc7b54-4df3-4bcb-a65a-3da1ecc997d7
        certificate:
          description: Apple certificate for sending push notifications. For iOS only
          type: string
          example: >-
            -----BEGIN CERTIFICATE-----
            MIIGVDCCBTKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END CERTIFICATE-----
        private_key:
          description: >-
            Apple private key for a given certificate for sending push
            notifications. For iOS only
          type: string
          example: >-
            -----BEGIN RSA PRIVATE KEY-----
            MIIEpQIBAAKCAQEAsNlRJVZn9ZvXcECQm65czs... -----END RSA PRIVATE
            KEY-----
        project_account_json_file:
          description: Google server key for sending push notifications. For Android only
          type: object
          example:
            private_key: BBBB0J56jd8kda:APA91vjb11BCjvxx3Jxja...
            client_email: account@customer.org
          additionalProperties: true
        alias:
          description: Alias to uniquely identify a credential
          type: string
          example: LucyCredential
        type:
          description: >-
            Type of mobile push credential. Either <code>ios</code> or
            <code>android</code>
          type: string
          example: ios
        record_type:
          type: string
          example: push_credential
          readOnly: true
        created_at:
          description: ISO 8601 timestamp when the room was created
          type: string
          format: date-time
          example: '2021-03-26T17:51:59.588408Z'
        updated_at:
          description: ISO 8601 timestamp when the room was updated.
          type: string
          format: date-time
          example: '2021-03-26T17:51:59.588408Z'
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
    push-notifications_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          example: '10015'
        title:
          type: string
          example: Bad Request
        detail:
          type: string
          example: has already been taken
        source:
          type: object
          properties:
            pointer:
              description: JSON pointer (RFC6901) to the offending entity.
              type: string
              example: /mobile_push_credentials
            parameter:
              description: Indicates which query parameter caused the error.
              type: string
              example: application_name
        meta:
          type: object
          example:
            url: https://developers.telnyx.com/docs/overview/errors/10015
          additionalProperties: true
      type: object
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
