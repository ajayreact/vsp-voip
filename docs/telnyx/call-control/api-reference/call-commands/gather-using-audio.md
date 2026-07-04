---
title: "Gather using audio"
source_url: "https://developers.telnyx.com/api-reference/call-commands/gather-using-audio.md"
category: "call-control"
synced_at: "2026-06-25T18:43:11.074Z"
content_hash: "415a5de1240a391185f39b1293d074689c14116a80fbcf8c6378d54b5330ce7a"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Gather using audio

> Play an audio file on the call until the required DTMF signals are gathered to build interactive menus.

You can pass a list of valid digits along with an 'invalid_audio_url', which will be played back at the beginning of each prompt. Playback will be interrupted when a DTMF signal is received. The `Answer command must be issued before the `gather_using_audio` command.

**Expected Webhooks:**

- `call.playback.started`
- `call.playback.ended`
- `call.dtmf.received` (you may receive many of these webhooks)
- `call.gather.ended`




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/gather-using-audio.yml post /calls/{call_control_id}/actions/gather_using_audio
openapi: 3.1.0
info:
  title: Telnyx Call Control - Gather Using Audio
  version: 2.0.0
  description: API for gathering input using audio.
  contact:
    email: support@telnyx.com
servers:
  - url: https://api.telnyx.com/v2
security:
  - bearerAuth: []
tags:
  - name: Command
    description: Call control command operations
paths:
  /calls/{call_control_id}/actions/gather_using_audio:
    post:
      tags:
        - Call Commands
      summary: Gather using audio
      description: >
        Play an audio file on the call until the required DTMF signals are
        gathered to build interactive menus.


        You can pass a list of valid digits along with an 'invalid_audio_url',
        which will be played back at the beginning of each prompt. Playback will
        be interrupted when a DTMF signal is received. The `Answer command must
        be issued before the `gather_using_audio` command.


        **Expected Webhooks:**


        - `call.playback.started`

        - `call.playback.ended`

        - `call.dtmf.received` (you may receive many of these webhooks)

        - `call.gather.ended`
      operationId: GatherUsingAudio
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Gather using audio request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GatherUsingAudioRequest'
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
            client.calls.actions.gatherUsingAudio('call_control_id');


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.gather_using_audio(
                call_control_id="call_control_id",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.GatherUsingAudio(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionGatherUsingAudioParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.calls.actions.ActionGatherUsingAudioParams;

            import
            com.telnyx.sdk.models.calls.actions.ActionGatherUsingAudioResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionGatherUsingAudioResponse response = client.calls().actions().gatherUsingAudio("call_control_id");
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response =
            telnyx.calls.actions.gather_using_audio("call_control_id")


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
              $response = $client->calls->actions->gatherUsingAudio(
                'call_control_id',
                audioURL: 'http://example.com/message.wav',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                interDigitTimeoutMillis: 10000,
                invalidAudioURL: 'http://example.com/message.wav',
                invalidMediaName: 'my_media_uploaded_to_media_storage_api',
                maximumDigits: 10,
                maximumTries: 3,
                mediaName: 'my_media_uploaded_to_media_storage_api',
                minimumDigits: 1,
                terminatingDigit: '#',
                timeoutMillis: 10000,
                validDigits: '123',
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions gather-using-audio \
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
    GatherUsingAudioRequest:
      type: object
      title: Gather Using Audio Request
      properties:
        audio_url:
          type: string
          example: http://example.com/message.wav
          description: >-
            The URL of a file to be played back at the beginning of each prompt.
            The URL can point to either a WAV or MP3 file. media_name and
            audio_url cannot be used together in one request.
        media_name:
          type: string
          example: my_media_uploaded_to_media_storage_api
          description: >-
            The media_name of a file to be played back at the beginning of each
            prompt. The media_name must point to a file previously uploaded to
            api.telnyx.com/v2/media by the same user/organization. The file must
            either be a WAV or MP3 file.
        invalid_audio_url:
          type: string
          description: >-
            The URL of a file to play when digits don't match the `valid_digits`
            parameter or the number of digits is not between `min` and `max`.
            The URL can point to either a WAV or MP3 file. invalid_media_name
            and invalid_audio_url cannot be used together in one request.
          example: http://example.com/invalid.wav
        invalid_media_name:
          type: string
          example: my_media_uploaded_to_media_storage_api
          description: >-
            The media_name of a file to be played back when digits don't match
            the `valid_digits` parameter or the number of digits is not between
            `min` and `max`. The media_name must point to a file previously
            uploaded to api.telnyx.com/v2/media by the same user/organization.
            The file must either be a WAV or MP3 file.
        minimum_digits:
          description: >-
            The minimum number of digits to fetch. This parameter has a minimum
            value of 1.
          default: 1
          type: integer
          example: 1
          format: int32
        maximum_digits:
          description: >-
            The maximum number of digits to fetch. This parameter has a maximum
            value of 128.
          default: 128
          type: integer
          example: 10
          format: int32
        maximum_tries:
          description: >-
            The maximum number of times the file should be played if there is no
            input from the user on the call.
          default: 3
          type: integer
          example: 3
          format: int32
        timeout_millis:
          description: >-
            The number of milliseconds to wait for a DTMF response after file
            playback ends before a replaying the sound file.
          default: 60000
          type: integer
          example: 60000
          format: int32
        terminating_digit:
          description: >-
            The digit used to terminate input if fewer than `maximum_digits`
            digits have been gathered.
          default: '#'
          type: string
          example: '#'
        valid_digits:
          description: A list of all digits accepted as valid.
          default: 0123456789#*
          type: string
          example: '123'
        inter_digit_timeout_millis:
          description: The number of milliseconds to wait for input between digits.
          default: 5000
          type: integer
          example: 10000
          format: int32
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
        audio_url: http://example.com/message.wav
        invalid_audio_url: http://example.com/message.wav
        minimum_digits: 1
        maximum_digits: 10
        timeout_millis: 10000
        terminating_digit: '#'
        valid_digits: '123'
        inter_digit_timeout_millis: 10000
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
