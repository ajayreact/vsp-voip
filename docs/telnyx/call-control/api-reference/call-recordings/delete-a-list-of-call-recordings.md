---
title: "Delete a list of call recordings"
source_url: "https://developers.telnyx.com/api-reference/call-recordings/delete-a-list-of-call-recordings.md"
category: "recordings"
synced_at: "2026-06-25T18:43:27.471Z"
content_hash: "204102a2a631818b1e99cb1cff859f5d3185133b63406c6e1efd1ea05e0a8e70"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Delete a list of call recordings

> Permanently deletes a list of call recordings.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/call-recordings.yml post /recordings/actions/delete
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
  /recordings/actions/delete:
    post:
      tags:
        - Call Recordings
      summary: Delete a list of call recordings
      description: Permanently deletes a list of call recordings.
      operationId: DeleteRecordings
      requestBody:
        $ref: '#/components/requestBodies/DeleteRecordingsRequest'
      responses:
        '200':
          description: The recordings have been successfully deleted.
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum:
                      - ok
                    example: ok
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

            const action = await client.recordings.actions.delete({
              ids: ['428c31b6-7af4-4bcb-b7f5-5013ef9657c1', '428c31b6-7af4-4bcb-b7f5-5013ef9657c2'],
            });

            console.log(action.status);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            action = client.recordings.actions.delete(
                ids=["428c31b6-7af4-4bcb-b7f5-5013ef9657c1", "428c31b6-7af4-4bcb-b7f5-5013ef9657c2"],
            )
            print(action.status)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\taction, err := client.Recordings.Actions.Delete(context.TODO(), telnyx.RecordingActionDeleteParams{\n\t\tIDs: []string{\"428c31b6-7af4-4bcb-b7f5-5013ef9657c1\", \"428c31b6-7af4-4bcb-b7f5-5013ef9657c2\"},\n\t})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", action.Status)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import com.telnyx.sdk.models.recordings.actions.ActionDeleteParams;

            import
            com.telnyx.sdk.models.recordings.actions.ActionDeleteResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionDeleteParams params = ActionDeleteParams.builder()
                        .addId("428c31b6-7af4-4bcb-b7f5-5013ef9657c1")
                        .addId("428c31b6-7af4-4bcb-b7f5-5013ef9657c2")
                        .build();
                    ActionDeleteResponse action = client.recordings().actions().delete(params);
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            action = telnyx.recordings.actions.delete(
              ids: ["428c31b6-7af4-4bcb-b7f5-5013ef9657c1", "428c31b6-7af4-4bcb-b7f5-5013ef9657c2"]
            )

            puts(action)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $action = $client->recordings->actions->delete(
                ids: [
                  '428c31b6-7af4-4bcb-b7f5-5013ef9657c1',
                  '428c31b6-7af4-4bcb-b7f5-5013ef9657c2',
                ],
              );

              var_dump($action);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx recordings:actions delete \
              --api-key 'My API Key' \
              --id 428c31b6-7af4-4bcb-b7f5-5013ef9657c1 \
              --id 428c31b6-7af4-4bcb-b7f5-5013ef9657c2
components:
  requestBodies:
    DeleteRecordingsRequest:
      description: Deletes recordings for the given list of IDs.
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - ids
            properties:
              ids:
                type: array
                description: List of call recording IDs to delete.
                items:
                  type: string
          example:
            ids:
              - 428c31b6-7af4-4bcb-b7f5-5013ef9657c1
              - 428c31b6-7af4-4bcb-b7f5-5013ef9657c2
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
