---
title: "Retrieves a mobile push credential"
source_url: "https://developers.telnyx.com/api-reference/push-credentials/retrieves-a-mobile-push-credential.md"
category: "authentication"
synced_at: "2026-06-25T18:42:59.772Z"
content_hash: "ea194507fe624794d47099e7b85d1d114a15c7ea5c146287317fb328820817ee"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Retrieves a mobile push credential

> Retrieves mobile push credential based on the given `push_credential_id`



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/mobile-push-credentials.yml get /mobile_push_credentials/{push_credential_id}
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
  /mobile_push_credentials/{push_credential_id}:
    get:
      tags:
        - Push Credentials
      summary: Retrieves a mobile push credential
      description: Retrieves mobile push credential based on the given `push_credential_id`
      operationId: GetPushCredentialById
      parameters:
        - name: push_credential_id
          in: path
          description: The unique identifier of a mobile push credential
          required: true
          schema:
            type: string
            format: uuid
            example: 0ccc7b76-4df3-4bca-a05a-3da1ecc389f0
      responses:
        '200':
          description: Successful get mobile push credential response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PushCredentialResponse'
        '401':
          description: Unauthorized request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/push-notifications_Errors'
        '404':
          description: Resource not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/push-notifications_Errors'
        '422':
          description: Unable to process request
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


            const pushCredentialResponse = await
            client.mobilePushCredentials.retrieve(
              '0ccc7b76-4df3-4bca-a05a-3da1ecc389f0',
            );


            console.log(pushCredentialResponse.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            push_credential_response = client.mobile_push_credentials.retrieve(
                "0ccc7b76-4df3-4bca-a05a-3da1ecc389f0",
            )
            print(push_credential_response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpushCredentialResponse, err := client.MobilePushCredentials.Get(context.TODO(), \"0ccc7b76-4df3-4bca-a05a-3da1ecc389f0\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", pushCredentialResponse.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.mobilepushcredentials.MobilePushCredentialRetrieveParams;

            import
            com.telnyx.sdk.models.mobilepushcredentials.PushCredentialResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    PushCredentialResponse pushCredentialResponse = client.mobilePushCredentials().retrieve("0ccc7b76-4df3-4bca-a05a-3da1ecc389f0");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            push_credential_response =
            telnyx.mobile_push_credentials.retrieve("0ccc7b76-4df3-4bca-a05a-3da1ecc389f0")


            puts(push_credential_response)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $pushCredentialResponse = $client->mobilePushCredentials->retrieve(
                '0ccc7b76-4df3-4bca-a05a-3da1ecc389f0'
              );

              var_dump($pushCredentialResponse);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx mobile-push-credentials retrieve \
              --api-key 'My API Key' \
              --push-credential-id 0ccc7b76-4df3-4bca-a05a-3da1ecc389f0
components:
  schemas:
    PushCredentialResponse:
      description: Success response with details about a push credential
      properties:
        data:
          $ref: '#/components/schemas/PushCredential'
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
