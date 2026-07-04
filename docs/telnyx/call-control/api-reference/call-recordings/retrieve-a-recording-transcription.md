---
title: "Retrieve a recording transcription"
source_url: "https://developers.telnyx.com/api-reference/call-recordings/retrieve-a-recording-transcription.md"
category: "recordings"
synced_at: "2026-06-25T18:43:28.105Z"
content_hash: "09582fdcf92fdc4a993a63a4b614b26da359309fac040e413fff053348682767"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Retrieve a recording transcription

> Retrieves the details of an existing recording transcription.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/call-recordings.yml get /recording_transcriptions/{recording_transcription_id}
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
  /recording_transcriptions/{recording_transcription_id}:
    get:
      tags:
        - Call Recordings
      summary: Retrieve a recording transcription
      description: Retrieves the details of an existing recording transcription.
      operationId: getRecordingTranscription
      parameters:
        - $ref: '#/components/parameters/RecordingTranscriptionId'
      responses:
        '200':
          description: A response with a single recording transcription resource.
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/RecordingTranscription'
        '401':
          $ref: '#/components/responses/call-recordings_UnauthorizedResponse'
        '404':
          $ref: '#/components/responses/call-recordings_NotFoundResponse'
        default:
          $ref: '#/components/responses/call-recordings_GenericErrorResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const recordingTranscription = await
            client.recordingTranscriptions.retrieve(
              '6a09cdc3-8948-47f0-aa62-74ac943d6c58',
            );


            console.log(recordingTranscription.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            recording_transcription = client.recording_transcriptions.retrieve(
                "6a09cdc3-8948-47f0-aa62-74ac943d6c58",
            )
            print(recording_transcription.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\trecordingTranscription, err := client.RecordingTranscriptions.Get(context.TODO(), \"6a09cdc3-8948-47f0-aa62-74ac943d6c58\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", recordingTranscription.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.recordingtranscriptions.RecordingTranscriptionRetrieveParams;

            import
            com.telnyx.sdk.models.recordingtranscriptions.RecordingTranscriptionRetrieveResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    RecordingTranscriptionRetrieveResponse recordingTranscription = client.recordingTranscriptions().retrieve("6a09cdc3-8948-47f0-aa62-74ac943d6c58");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            recording_transcription =
            telnyx.recording_transcriptions.retrieve("6a09cdc3-8948-47f0-aa62-74ac943d6c58")


            puts(recording_transcription)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $recordingTranscription = $client->recordingTranscriptions->retrieve(
                '6a09cdc3-8948-47f0-aa62-74ac943d6c58'
              );

              var_dump($recordingTranscription);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx recording-transcriptions retrieve \
              --api-key 'My API Key' \
              --recording-transcription-id 6a09cdc3-8948-47f0-aa62-74ac943d6c58
components:
  parameters:
    RecordingTranscriptionId:
      name: recording_transcription_id
      in: path
      required: true
      description: Uniquely identifies the recording transcription by id.
      schema:
        format: uuid
        type: string
        example: 6a09cdc3-8948-47f0-aa62-74ac943d6c58
  schemas:
    RecordingTranscription:
      type: object
      title: RecordingTranscriptionsResponseData
      properties:
        created_at:
          type: string
          description: ISO 8601 formatted date indicating when the resource was created.
          example: '2018-02-02T22:25:27.521Z'
        duration_millis:
          description: The duration of the recording transcription in milliseconds.
          type: integer
          format: int32
          example: 60000
        id:
          type: string
          description: Uniquely identifies the recording transcription.
          example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
        recording_id:
          type: string
          description: >-
            Uniquely identifies the recording associated with this
            transcription.
          example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
        record_type:
          type: string
          enum:
            - recording_transcription
          example: recording_transcription
        status:
          type: string
          enum:
            - in-progress
            - completed
          description: >-
            The status of the recording transcription. Only `completed` has
            transcription text available.
          example: completed
        transcription_text:
          type: string
          description: The recording's transcribed text.
          example: Good morning, how may I help you?
        updated_at:
          type: string
          description: ISO 8601 formatted date indicating when the resource was updated.
          example: '2018-02-02T22:25:27.521Z'
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
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
