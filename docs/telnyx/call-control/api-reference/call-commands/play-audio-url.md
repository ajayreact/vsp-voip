---
title: "Play audio URL"
source_url: "https://developers.telnyx.com/api-reference/call-commands/play-audio-url.md"
category: "call-control"
synced_at: "2026-06-25T18:43:12.285Z"
content_hash: "ca3f67a2c4af8d888c9eb041b12702329e8a71d858a0ad160d27520027834f1d"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Play audio URL

> Play an audio file on the call. If multiple play audio commands are issued consecutively,
the audio files will be placed in a queue awaiting playback.

*Notes:*

- When `overlay` is enabled, `target_legs` is limited to `self`.
- A customer cannot Play Audio with `overlay=true` unless there is a Play Audio with `overlay=false` actively playing.

**Expected Webhooks:**

- `call.playback.started`
- `call.playback.ended`




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/playback-start.yml post /calls/{call_control_id}/actions/playback_start
openapi: 3.1.0
info:
  title: Telnyx Call Control - Playback Start
  version: 2.0.0
  description: API for starting audio playback.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
tags:
  - name: Command
    description: Call control command operations
  - name: Callbacks
    description: Webhook callbacks for call events
paths:
  /calls/{call_control_id}/actions/playback_start:
    post:
      tags:
        - Call Commands
      summary: Play audio URL
      description: >
        Play an audio file on the call. If multiple play audio commands are
        issued consecutively,

        the audio files will be placed in a queue awaiting playback.


        *Notes:*


        - When `overlay` is enabled, `target_legs` is limited to `self`.

        - A customer cannot Play Audio with `overlay=true` unless there is a
        Play Audio with `overlay=false` actively playing.


        **Expected Webhooks:**


        - `call.playback.started`

        - `call.playback.ended`
      operationId: StartCallPlayback
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Play audio URL request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PlayAudioUrlRequest'
      responses:
        '200':
          description: Successful response upon making a call control command.
          content:
            application/json:
              schema:
                type: object
                title: Call Control Command Response
                properties:
                  data:
                    $ref: '#/components/schemas/CallControlCommandResult'
        '422':
          $ref: '#/components/responses/UnprocessableEntityResponse'
        default:
          $ref: '#/components/responses/call-control_GenericErrorResponse'
      x-codeSamples:
        - lang: JavaScript
          source: >-
            import Telnyx from 'telnyx';


            const client = new Telnyx({
              apiKey: process.env['TELNYX_API_KEY'], // This is the default and can be omitted
            });


            const response = await
            client.calls.actions.startPlayback('call_control_id');


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.start_playback(
                call_control_id="call_control_id",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.StartPlayback(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionStartPlaybackParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.calls.actions.ActionStartPlaybackParams;

            import
            com.telnyx.sdk.models.calls.actions.ActionStartPlaybackResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionStartPlaybackResponse response = client.calls().actions().startPlayback("call_control_id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            response = telnyx.calls.actions.start_playback("call_control_id")

            puts(response)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $response = $client->calls->actions->startPlayback(
                'call_control_id',
                audioType: 'wav',
                audioURL: 'http://www.example.com/sounds/greeting.wav',
                cacheAudio: true,
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                loop: 'infinity',
                mediaName: 'my_media_uploaded_to_media_storage_api',
                overlay: true,
                playbackContent: 'SUQzAwAAAAADf1...',
                stop: 'current',
                targetLegs: 'self',
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions start-playback \
              --api-key 'My API Key' \
              --call-control-id call_control_id
components:
  parameters:
    CallControlId:
      name: call_control_id
      description: Unique identifier and token for controlling the call
      in: path
      required: true
      schema:
        type: string
  schemas:
    PlayAudioUrlRequest:
      type: object
      title: Play Audio URL Request
      properties:
        audio_url:
          type: string
          example: http://example.com/message.wav
          description: >-
            The URL of a file to be played back on the call. The URL can point
            to either a WAV or MP3 file. media_name and audio_url cannot be used
            together in one request.
        media_name:
          type: string
          example: my_media_uploaded_to_media_storage_api
          description: >-
            The media_name of a file to be played back on the call. The
            media_name must point to a file previously uploaded to
            api.telnyx.com/v2/media by the same user/organization. The file must
            either be a WAV or MP3 file.
        loop:
          $ref: '#/components/schemas/Loopcount'
          description: >-
            The number of times the audio file should be played. If supplied,
            the value must be an integer between 1 and 100, or the special
            string `infinity` for an endless loop.
          example: infinity
          default: 1
        overlay:
          description: >-
            When enabled, audio will be mixed on top of any other audio that is
            actively being played back. Note that `overlay: true` will only work
            if there is another audio file already being played on the call.
          type: boolean
          example: true
          default: false
        stop:
          description: >-
            When specified, it stops the current audio being played. Specify
            `current` to stop the current audio being played, and to play the
            next file in the queue. Specify `all` to stop the current audio file
            being played and to also clear all audio files from the queue.
          type: string
          example: current
        target_legs:
          description: >-
            Specifies the leg or legs on which audio will be played. If
            supplied, the value must be either `self`, `opposite` or `both`.
          type: string
          default: self
          example: self
        cache_audio:
          description: >-
            Caches the audio file. Useful when playing the same audio file
            multiple times during the call.
          type: boolean
          default: true
          example: true
        audio_type:
          description: >-
            Specifies the type of audio provided in `audio_url` or
            `playback_content`.
          type: string
          enum:
            - mp3
            - wav
          default: mp3
          example: wav
        playback_content:
          description: >-
            Allows a user to provide base64 encoded mp3 or wav. Note: when using
            this parameter, `media_url` and `media_name` in the
            `playback_started` and `playback_ended` webhooks will be empty
          type: string
          example: SUQzAwAAAAADf1...
        client_state:
          description: >-
            Use this field to add state to every subsequent webhook. It must be
            a valid Base-64 encoded string.
          type: string
          example: aGF2ZSBhIG5pY2UgZGF5ID1d
        command_id:
          description: >-
            Use this field to avoid duplicate commands. Telnyx will ignore any
            command with the same `command_id` for the same `call_control_id`.
          type: string
          example: 891510ac-f3e4-11e8-af5b-de00688a4901
      example:
        audio_url: http://www.example.com/sounds/greeting.wav
        loop: infinity
        overlay: true
        stop: current
        target_legs: self
        client_state: aGF2ZSBhIG5pY2UgZGF5ID1d
        command_id: 891510ac-f3e4-11e8-af5b-de00688a4901
    CallControlCommandResult:
      type: object
      title: Call Control Command Result
      example:
        result: ok
      properties:
        result:
          type: string
          example: ok
    Loopcount:
      oneOf:
        - type: string
        - type: integer
    call-control_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/call-control_Error'
    call-control_Error:
      required:
        - code
        - title
      properties:
        code:
          type: string
          format: integer
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
    UnprocessableEntityResponse:
      description: >-
        Unprocessable entity. The request was well-formed but could not be
        processed due to semantic errors. This includes validation errors,
        invalid parameter values, call state errors, conference errors, queue
        errors, recording/transcription errors, and business logic violations.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-control_Errors'
          examples:
            missing_required_parameter:
              summary: Missing required parameter
              value:
                errors:
                  - code: '10004'
                    title: Missing required parameter
                    detail: The 'to' parameter is required and cannot be blank.
                    source:
                      pointer: /to
            invalid_call_control_id:
              summary: Invalid call control ID
              value:
                errors:
                  - code: '90015'
                    title: Invalid Call Control ID
                    detail: The call_control_id provided was not valid.
                    source:
                      pointer: /call_control_id
            call_already_ended:
              summary: Call has already ended
              value:
                errors:
                  - code: '90018'
                    title: Call has already ended
                    detail: This call is no longer active and can't receive commands.
            call_not_answered:
              summary: Call not answered yet
              value:
                errors:
                  - code: '90034'
                    title: Call not answered yet
                    detail: >-
                      This call can't receive this command because it has not
                      been answered yet.
            cannot_record_before_audio_started:
              summary: Cannot record before audio started
              value:
                errors:
                  - code: '90020'
                    title: Call recording triggered before audio started
                    detail: >-
                      Call recording cannot be started until audio has commenced
                      on the call.
            transcription_already_active:
              summary: Transcription already active
              value:
                errors:
                  - code: '90054'
                    title: Call transcription is already in progress
                    detail: Call transcription can not be started more than once.
            ai_assistant_already_active:
              summary: AI Assistant already active
              value:
                errors:
                  - code: '90061'
                    title: AI Assistant is already in progress
                    detail: AI Assistant cannot be started more than once.
            conference_already_ended:
              summary: Conference has already ended
              value:
                errors:
                  - code: '90019'
                    title: Conference has already ended
                    detail: >-
                      This conference is no longer active and can't receive
                      commands.
            conference_name_conflict:
              summary: Conference name conflict
              value:
                errors:
                  - code: '90033'
                    title: Unable to execute command
                    detail: Conference with given name already exists and it's active.
            max_participants_reached:
              summary: Maximum participants reached
              value:
                errors:
                  - code: '90032'
                    title: Maximum number of participants reached
                    detail: >-
                      The maximum allowed value of `max_participants` has been
                      reached at 100.
            queue_full:
              summary: Queue is full
              value:
                errors:
                  - code: '90036'
                    title: Queue full
                    detail: The 'support' queue is full and can't accept more calls.
            call_already_in_queue:
              summary: Call already in queue
              value:
                errors:
                  - code: '90038'
                    title: Call already in queue
                    detail: Call can't be added to a queue it's already in.
            invalid_connection_id:
              summary: Invalid connection ID
              value:
                errors:
                  - code: '10015'
                    title: Invalid value for connection_id (Call Control App ID)
                    detail: >-
                      The requested connection_id (Call Control App ID) is
                      either invalid or does not exist. Only Call Control Apps
                      with valid webhook URL are accepted.
                    source:
                      pointer: /connection_id
            invalid_phone_number_format:
              summary: Invalid phone number format
              value:
                errors:
                  - code: '10016'
                    title: Phone number must be in +E164 format
                    detail: The 'to' parameter must be in E164 format.
                    source:
                      pointer: /to
            srtp_not_supported_for_pstn:
              summary: SRTP not supported for PSTN calls
              value:
                errors:
                  - source:
                      pointer: /media_encryption
                    title: Media encryption not supported for PSTN calls
                    detail: SRTP media encryption is not supported for PSTN calls.
                    code: '10011'
            fork_not_found:
              summary: Call is not forked
              value:
                errors:
                  - code: '90031'
                    title: Call is not currently forked
                    detail: >-
                      Can't stop forking, because the call isn't currently
                      forked.
            media_streaming_used:
              summary: Media streaming in use
              value:
                errors:
                  - code: '90045'
                    title: Media Streaming is used
                    detail: This command can't be issued when media streaming is used.
            invalid_enumerated_value:
              summary: Invalid enumerated value
              value:
                errors:
                  - code: '10032'
                    title: Invalid enumerated value
                    detail: 'The value must be one of: dual, single.'
                    source:
                      pointer: /record_channels
            value_outside_range:
              summary: Value outside of range
              value:
                errors:
                  - code: '10033'
                    title: Value outside of range
                    detail: The value is outside of allowed range 1 to 5000
                    source:
                      pointer: /max_participants
    call-control_GenericErrorResponse:
      description: Unexpected error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/call-control_Errors'
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````
