---
title: "Deletes a mobile push credential"
source_url: "https://developers.telnyx.com/api-reference/push-credentials/deletes-a-mobile-push-credential.md"
category: "authentication"
synced_at: "2026-06-25T18:43:00.009Z"
content_hash: "879d28c070d746391b575a47e8b0b2359ea10e831acb40d5d901f3663bfeea5c"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Deletes a mobile push credential

> Deletes a mobile push credential based on the given `push_credential_id`



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/webrtc/mobile-push-credentials.yml delete /mobile_push_credentials/{push_credential_id}
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
    delete:
      tags:
        - Push Credentials
      summary: Deletes a mobile push credential
      description: Deletes a mobile push credential based on the given `push_credential_id`
      operationId: DeletePushCredentialById
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
        '204':
          description: The mobile push credential was deleted successfully
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


            await
            client.mobilePushCredentials.delete('0ccc7b76-4df3-4bca-a05a-3da1ecc389f0');
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            client.mobile_push_credentials.delete(
                "0ccc7b76-4df3-4bca-a05a-3da1ecc389f0",
            )
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\terr := client.MobilePushCredentials.Delete(context.TODO(), \"0ccc7b76-4df3-4bca-a05a-3da1ecc389f0\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.mobilepushcredentials.MobilePushCredentialDeleteParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    client.mobilePushCredentials().delete("0ccc7b76-4df3-4bca-a05a-3da1ecc389f0");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            result =
            telnyx.mobile_push_credentials.delete("0ccc7b76-4df3-4bca-a05a-3da1ecc389f0")


            puts(result)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $result = $client->mobilePushCredentials->delete(
                '0ccc7b76-4df3-4bca-a05a-3da1ecc389f0'
              );

              var_dump($result);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx mobile-push-credentials delete \
              --api-key 'My API Key' \
              --push-credential-id 0ccc7b76-4df3-4bca-a05a-3da1ecc389f0
components:
  schemas:
    push-notifications_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/push-notifications_Error'
      type: object
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
