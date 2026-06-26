---
title: "Delete a call recording"
source_url: "https://developers.telnyx.com/api-reference/call-recordings/delete-a-call-recording.md"
category: "recordings"
synced_at: "2026-06-25T18:43:27.201Z"
content_hash: "850d0dd64b1baeeacf3b7f4e1a638e3e67debba1b4ed0d1bd7ff87fc5e6dac22"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Delete a call recording

> Permanently deletes a call recording.



## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/real-time-communications/call-recordings.yml delete /recordings/{recording_id}
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
  /recordings/{recording_id}:
    delete:
      tags:
        - Call Recordings
      summary: Delete a call recording
      description: Permanently deletes a call recording.
      operationId: DeleteRecording
      parameters:
        - $ref: '#/components/parameters/RecordingId'
      responses:
        '200':
          description: A response with a single recording resource.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RecordingResponse'
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

            const recording = await client.recordings.delete('recording_id');

            console.log(recording.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            recording = client.recordings.delete(
                "recording_id",
            )
            print(recording.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\trecording, err := client.Recordings.Delete(context.TODO(), \"recording_id\")\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", recording.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.recordings.RecordingDeleteParams;
            import com.telnyx.sdk.models.recordings.RecordingDeleteResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    RecordingDeleteResponse recording = client.recordings().delete("recording_id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            recording = telnyx.recordings.delete("recording_id")

            puts(recording)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $recording = $client->recordings->delete('recording_id');

              var_dump($recording);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx recordings delete \
              --api-key 'My API Key' \
              --recording-id recording_id
components:
  parameters:
    RecordingId:
      name: recording_id
      description: Uniquely identifies the recording by id.
      in: path
      required: true
      schema:
        type: string
  schemas:
    RecordingResponse:
      type: object
      title: RecordingResponse
      properties:
        data:
          $ref: '#/components/schemas/RecordingResponseData'
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
