---
title: "List all call recordings"
source_url: "https://developers.telnyx.com/api-reference/call-recordings/list-all-call-recordings.md"
category: "recordings"
synced_at: "2026-06-25T18:43:26.541Z"
content_hash: "8a3c03df9005deff12239a5fce4dcdad7e45750b80b52177f9ad2f9c37f1dc0d"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# List all call recordings

> Returns a list of your call recordings.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/call-recordings.yml get /recordings
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
  /recordings:
    get:
      tags:
        - Call Recordings
      summary: List all call recordings
      description: Returns a list of your call recordings.
      operationId: GetRecordings
      parameters:
        - $ref: '#/components/parameters/call-recordings_PageConsolidated'
        - name: filter
          in: query
          style: deepObject
          explode: true
          description: Filter recordings by various attributes.
          schema:
            type: object
            properties:
              conference_id:
                type: string
                example: 428c31b6-7af4-4bcb-b7f5-5013ef9657c1
                description: Returns only recordings associated with a given conference.
              created_at:
                type: object
                additionalProperties: false
                properties:
                  gte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only recordings created later than or at given ISO
                      8601 datetime.
                  lte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only recordings created earlier than or at given
                      ISO 8601 datetime.
              call_leg_id:
                type: string
                format: uuid
                example: 428c31b6-7af4-4bcb-b7f5-5013ef9657c1
                description: >-
                  If present, recordings will be filtered to those with a
                  matching call_leg_id.
              call_session_id:
                type: string
                format: uuid
                example: 428c31b6-7af4-4bcb-b7f5-5013ef9657c1
                description: >-
                  If present, recordings will be filtered to those with a
                  matching call_session_id.
              from:
                type: string
                example: '1234567890'
                description: >-
                  If present, recordings will be filtered to those with a
                  matching `from` attribute (case-sensitive).
              to:
                type: string
                example: '1234567890'
                description: >-
                  If present, recordings will be filtered to those with a
                  matching `to` attribute (case-sensitive).
              connection_id:
                type: string
                example: '175237942907135762'
                description: >-
                  If present, recordings will be filtered to those with a
                  matching `connection_id` attribute (case-sensitive).
              sip_call_id:
                type: string
                example: 428c31b6-7af4-4bcb-b7f5-5013ef9657c1
                description: >-
                  If present, recordings will be filtered to those with a
                  matching `sip_call_id` attribute. Matching is case-sensitive.
              call_control_id:
                type: string
                example: v3:e-31OnvjEM7Y4wvxr3TKNk8M3QyLcGZPiUIzCGtwQtOtEjY-B0urkw
                description: >-
                  If present, recordings will be filtered to those with a
                  matching `call_control_id`.
              conference_region:
                type: string
                example: us
                description: >-
                  If present, recordings will be filtered to those with a
                  matching `conference_region`.
              start_time:
                type: object
                additionalProperties: false
                properties:
                  gte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only recordings with a start time later than or
                      equal to the given ISO 8601 datetime.
                  lte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only recordings with a start time earlier than or
                      equal to the given ISO 8601 datetime.
              end_time:
                type: object
                additionalProperties: false
                properties:
                  gte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only recordings with an end time later than or
                      equal to the given ISO 8601 datetime.
                  lte:
                    type: string
                    example: '2019-03-29T11:10:00Z'
                    description: >-
                      Returns only recordings with an end time earlier than or
                      equal to the given ISO 8601 datetime.
      responses:
        '200':
          description: A response containing multiple recordings.
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/RecordingResponseData'
                  meta:
                    $ref: '#/components/schemas/PaginationMeta'
        '401':
          $ref: '#/components/responses/call-recordings_UnauthorizedResponse'
        '403':
          $ref: '#/components/responses/ForbiddenResponse'
        '404':
          $ref: '#/components/responses/call-recordings_NotFoundResponse'
        '500':
          $ref: '#/components/responses/call-recordings_InternalServerErrorResponse'
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

            for await (const recordingResponseData of client.recordings.list())
            {
              console.log(recordingResponseData.id);
            }
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            page = client.recordings.list()
            page = page.data[0]
            print(page.id)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tpage, err := client.Recordings.List(context.TODO(), telnyx.RecordingListParams{})\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", page)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.recordings.RecordingListPage;
            import com.telnyx.sdk.models.recordings.RecordingListParams;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    RecordingListPage page = client.recordings().list();
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            page = telnyx.recordings.list

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
              $page = $client->recordings->list(
                filter: [
                  'callControlID' => 'v3:e-31OnvjEM7Y4wvxr3TKNk8M3QyLcGZPiUIzCGtwQtOtEjY-B0urkw',
                  'callLegID' => '428c31b6-7af4-4bcb-b7f5-5013ef9657c1',
                  'callSessionID' => '428c31b6-7af4-4bcb-b7f5-5013ef9657c1',
                  'conferenceID' => '428c31b6-7af4-4bcb-b7f5-5013ef9657c1',
                  'conferenceRegion' => 'us',
                  'connectionID' => '175237942907135762',
                  'createdAt' => [
                    'gte' => '2019-03-29T11:10:00Z', 'lte' => '2019-03-29T11:10:00Z'
                  ],
                  'endTime' => [
                    'gte' => '2019-03-29T11:10:00Z', 'lte' => '2019-03-29T11:10:00Z'
                  ],
                  'from' => '1234567890',
                  'sipCallID' => '428c31b6-7af4-4bcb-b7f5-5013ef9657c1',
                  'startTime' => [
                    'gte' => '2019-03-29T11:10:00Z', 'lte' => '2019-03-29T11:10:00Z'
                  ],
                  'to' => '1234567890',
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
            telnyx recordings list \
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
    RecordingResponseData:
      type: object
      title: RecordingResponseData
      properties:
        call_control_id:
          type: string
          example: v3:e-31OnvjEM7Y4wvxr3TKNk8M3QyLcGZPiUIzCGtwQtOtEjY-B0urkw
          description: Unique identifier and token for controlling the call.
        call_leg_id:
          type: string
          example: 84a97d76-e40f-11ed-9074-02420a0daa69
          description: ID unique to the call leg (used to correlate webhook events).
        call_session_id:
          type: string
          example: 84a97d76-e40f-11ed-9074-02420a0daa69
          description: >-
            ID that is unique to the call session and can be used to correlate
            webhook events. Call session is a group of related call legs that
            logically belong to the same phone call, e.g. an inbound and
            outbound leg of a transferred call.
        channels:
          type: string
          enum:
            - single
            - dual
          description: >-
            When `dual`, the final audio file has the first leg on channel A,
            and the rest on channel B.
          example: dual
        conference_id:
          type: string
          example: 84a97d76-e40f-11ed-9074-02420a0daa69
          description: Uniquely identifies the conference.
        created_at:
          type: string
          description: ISO 8601 formatted date indicating when the resource was created.
          example: '2018-02-02T22:25:27.521Z'
        download_urls:
          type: object
          description: Links to download the recording files.
          properties:
            mp3:
              type: string
              description: Link to download the recording in mp3 format.
            wav:
              type: string
              description: Link to download the recording in wav format.
        duration_millis:
          description: The duration of the recording in milliseconds.
          type: integer
          format: int32
          example: 60000
        id:
          type: string
          description: Uniquely identifies the recording.
          example: 3fa85f64-5717-4562-b3fc-2c963f66afa6
        record_type:
          type: string
          enum:
            - recording
          example: recording
        recording_started_at:
          type: string
          description: ISO 8601 formatted date of when the recording started.
          example: '2019-01-23T18:10:02.574Z'
        recording_ended_at:
          type: string
          description: ISO 8601 formatted date of when the recording ended.
          example: '2019-01-23T18:10:02.574Z'
        source:
          type: string
          enum:
            - conference
            - call
          description: The kind of event that led to this recording being created.
          example: conference
        status:
          type: string
          enum:
            - completed
          description: >-
            The status of the recording. Only `completed` recordings are
            currently supported.
          example: completed
        from:
          type: string
          description: >-
            The `from` (caller) number for the call that generated this
            recording.
          example: '+15551234567'
        to:
          type: string
          description: The `to` (callee) number for the call that generated this recording.
          example: '+15557654321'
        connection_id:
          type: string
          description: >-
            Identifies the Telnyx application (Call Control, TeXML) or SIP
            connection resource associated with this recording.
          example: '175237942907135762'
        initiated_by:
          type: string
          description: >-
            Indicates what triggered the recording. Possible values include
            `DialVerb`, `Conference`, `OutboundAPI`, `Trunking`, `RecordVerb`,
            `StartCallRecordingAPI`, `StartConferenceRecordingAPI`.
          example: StartCallRecordingAPI
        updated_at:
          type: string
          description: ISO 8601 formatted date indicating when the resource was updated.
          example: '2018-02-02T22:25:27.521Z'
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
    ForbiddenResponse:
      description: Forbidden. The request is understood but has been refused.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
          example:
            errors:
              - code: '403'
                title: Forbidden
                detail: Forbidden
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
    call-recordings_InternalServerErrorResponse:
      description: Internal server error. An unexpected error occurred on the server.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-recordings_Errors'
          example:
            errors:
              - code: '500'
                title: Internal Server Error
                detail: Internal server error
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
