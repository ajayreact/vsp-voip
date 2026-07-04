---
title: "List all recording transcriptions"
source_url: "https://developers.telnyx.com/api-reference/call-recordings/list-all-recording-transcriptions.md"
category: "recordings"
synced_at: "2026-06-25T18:43:27.735Z"
content_hash: "e8704ba2751a34a1bc93fd901d734552ae8d9c6df5ab2c8c85b5b439afd2937e"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List all recording transcriptions

> Returns a list of your recording transcriptions.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/call-recordings.yml get /recording_transcriptions
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
  /recording_transcriptions:
    get:
      tags:
        - Call Recordings
      summary: List all recording transcriptions
      description: Returns a list of your recording transcriptions.
      operationId: getRecordingTranscriptions
      parameters:
        - $ref: '#/components/parameters/call-recordings_PageConsolidated'
        - name: filter
          in: query
          style: deepObject
          explode: true
          description: Filter recording transcriptions by various attributes.
          schema:
            type: object
            properties:
              recording_id:
                type: string
                format: uuid
                example: 428c31b6-7af4-4bcb-b7f5-5013ef9657c1
                description: >-
                  If present, transcriptions will be filtered to those
                  associated with the given recording.
              created_at:
                type: object
                additionalProperties: false
                properties:
                  gte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only transcriptions created later than or at given
                      ISO 8601 datetime.
                  lte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only transcriptions created earlier than or at
                      given ISO 8601 datetime.
      responses:
        '200':
          description: A response listing multiple recording transcriptions.
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/RecordingTranscription'
                  meta:
                    $ref: '#/components/schemas/call-recordings_CursorPaginationMeta'
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


            // Automatically fetches more pages as needed.

            for await (const recordingTranscription of
            client.recordingTranscriptions.list()) {
              console.log(recordingTranscription.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.recording_transcriptions.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.RecordingTranscriptions.List(context.TODO(), telnyx.RecordingTranscriptionListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.recordingtranscriptions.RecordingTranscriptionListPage;

            import
            com.telnyx.sdk.models.recordingtranscriptions.RecordingTranscriptionListParams;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    RecordingTranscriptionListPage page = client.recordingTranscriptions().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.recording_transcriptions.list

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
              $page = $client->recordingTranscriptions->list(
                filter: [
                  'createdAt' => [
                    'gte' => '2019-03-29T11:10:00Z', 'lte' => '2019-03-29T11:10:00Z'
                  ],
                  'recordingID' => '428c31b6-7af4-4bcb-b7f5-5013ef9657c1',
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
            telnyx recording-transcriptions list \
              --api-key 'My API Key'
components:
  parameters:
    call-recordings_PageConsolidated:
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
    call-recordings_CursorPaginationMeta:
      type: object
      title: Cursor Pagination Meta
      properties:
        cursors:
          $ref: '#/components/schemas/Cursor'
        next:
          type: string
          description: Path to next page.
          example: >-
            /v2/recording_transcriptions?page[after]=v1:g3QAAAADZAAKdGVsbnl4X2lkc2wAAAABbQAAACRlYmRiYzdkNi1kZWRmLTExZWQtYTM3MS0wMjQyMGFlZjAwYjRqZAAJdGltZXN0YW1wbggA8Le4pGhpVxdkAAR0eXBlZAAFYWZ0ZXI=
        previous:
          type: string
          description: Path to previous page.
          example: >-
            /v2/recording_transcriptions?page[before]=v1:g3QAAAADZAAKdGVsbnl4X2lkc2wAAAABbQAAACRlYmRiYzdkNi1kZWRmLTExZWQtYTM3MS0wMjQyMGFlZjAwYjRqZAAJdGltZXN0YW1wbggA8Le4pGhpVxdkAAR0eXBlZAAFYWZ0ZXI=
    Cursor:
      type: object
      properties:
        after:
          type: string
          description: Opaque identifier of next page.
          example: >-
            v1:g3QAAAADZAAKdGVsbnl4X2lkc2wAAAABbQAAACRlYmRiYzdkNi1kZWRmLTExZWQtYTM3MS0wMjQyMGFlZjAwYjRqZAAJdGltZXN0YW1wbggA8Le4pGhpVxdkAAR0eXBlZAAFYWZ0ZXI=
        before:
          type: string
          description: Opaque identifier of previous page.
          example: >-
            v1:g3QAAAADZAAKdGVsbnl4X2lkc2wAAAABbQAAACRlYmRiYzdkNi1kZWRmLTExZWQtYTM3MS0wMjQyMGFlZjAwYjRqZAAJdGltZXN0YW1wbggA8Le4pGhpVxdkAAR0eXBlZAAFYWZ0ZXI=
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
