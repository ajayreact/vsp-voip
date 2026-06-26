---
title: "Delete a stored credential"
source_url: "https://developers.telnyx.com/api-reference/call-recordings/delete-a-stored-credential.md"
category: "recordings"
synced_at: "2026-06-25T18:43:29.945Z"
content_hash: "08e2bae2ec844726cb596cc5c2922b7d9106214b64a1c45d8e0f5a38f5d6e9f9"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Delete a stored credential

> Deletes a stored custom credentials configuration.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/call-recordings.yml delete /custom_storage_credentials/{connection_id}
openapi: 3.1.0
info:
  title: Telnyx Call Recordings API
  version: 2.0.0
  description: API for Call recordings.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
paths:
  /custom_storage_credentials/{connection_id}:
    delete:
      tags:
        - Call Recordings
      summary: Delete a stored credential
      description: Deletes a stored custom credentials configuration.
      operationId: DeleteCustomStorageCredentials
      parameters:
        - $ref: '#/components/parameters/call-recordings_ConnectionId'
      responses:
        '204':
          description: >-
            The credentials configuration for connection_id was deleted
            successfully.
        '401':
          $ref: '#/components/responses/call-recordings_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/call-recordings_NotFoundResponse'
        default:
          $ref: '#/components/responses/call-recordings_GenericErrorResponse'
      x-codeSamples:
        - lang: JavaScript
          source: |-
            import Telnyx from 'telnyx';

            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });

            await client.customStorageCredentials.delete('connection_id');
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            client.custom_storage_credentials.delete(
                "connection_id",
            )
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\terr := client.CustomStorageCredentials.Delete(context.TODO(), \"connection_id\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.customstoragecredentials.CustomStorageCredentialDeleteParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    client.customStorageCredentials().delete("connection_id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            result = telnyx.custom_storage_credentials.delete("connection_id")

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
              $result = $client->customStorageCredentials->delete('connection_id');

              var_dump($result);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx custom-storage-credentials delete \
              --api-key 'My API Key' \
              --connection-id connection_id
components:
  parameters:
    call-recordings_ConnectionId:
      name: connection_id
      description: >-
        Uniquely identifies a Telnyx application (Call Control, TeXML) or Sip
        connection resource.
      in: path
      required: true
      schema:
        type: string
  responses:
    call-recordings_UnauthorizedResponse:
      description: Unauthorized. The request lacks valid authentication credentials.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
          example:
            errors:
              - code: '401'
                title: Unauthorized
                detail: Unauthorized
    call-recordings_NotFoundResponse:
      description: Resource not found. The requested resource or URL could not be found.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
          examples:
            not_found:
              summary: Generic not found
              value:
                errors:
                  - code: '404'
                    title: Not Found
                    detail: Page not found
            connection_not_found:
              summary: Connection not found
              value:
                errors:
                  - code: '10005'
                    title: Resource not found
                    detail: The requested resource or URL could not be found.
                    source:
                      pointer: /connection_id
    call-recordings_GenericErrorResponse:
      description: Unexpected error.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
  schemas:
    call-recordings_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/call-recordings_Error'
      type: object
    call-recordings_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          description: Error code identifier (string or numeric string).
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
            parameter:
              description: Indicates which query parameter caused the error.
              type: string
        meta:
          type: object
          additionalProperties: true
      type: object
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
