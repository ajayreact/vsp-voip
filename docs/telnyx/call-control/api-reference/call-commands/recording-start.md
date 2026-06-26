---
title: "Recording start"
source_url: "https://developers.telnyx.com/api-reference/call-commands/recording-start.md"
category: "recordings"
synced_at: "2026-06-25T18:43:12.806Z"
content_hash: "036ac6c05fce1ee3234028ca73a117ac3169171728036455c1e90bca71c065a6"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Recording start

> Start recording the call. Recording will stop on call hang-up, or can be initiated via the Stop Recording command.

**Expected Webhooks:**

- `call.recording.saved`
- `call.recording.transcription.saved`
- `call.recording.error`




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/record-start.yml post /calls/{call_control_id}/actions/record_start
openapi: 3.1.0
info:
  title: Telnyx Call Control - Record Start
  version: 2.0.0
  description: API for starting call recording.
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
  /calls/{call_control_id}/actions/record_start:
    post:
      tags:
        - Call Commands
      summary: Recording start
      description: >
        Start recording the call. Recording will stop on call hang-up, or can be
        initiated via the Stop Recording command.


        **Expected Webhooks:**


        - `call.recording.saved`

        - `call.recording.transcription.saved`

        - `call.recording.error`
      operationId: StartCallRecord
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Start recording audio request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/StartRecordingRequest'
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
            client.calls.actions.startRecording('call_control_id', {
              channels: 'single',
              format: 'wav',
            });


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.start_recording(
                call_control_id="call_control_id",
                channels="single",
                format="wav",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.StartRecording(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionStartRecordingParams{\n\t\t\tChannels: telnyx.CallActionStartRecordingParamsChannelsSingle,\n\t\t\tFormat:   telnyx.CallActionStartRecordingParamsFormatWav,\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.calls.actions.ActionStartRecordingParams;

            import
            com.telnyx.sdk.models.calls.actions.ActionStartRecordingResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionStartRecordingParams params = ActionStartRecordingParams.builder()
                        .callControlId("call_control_id")
                        .channels(ActionStartRecordingParams.Channels.SINGLE)
                        .format(ActionStartRecordingParams.Format.WAV)
                        .build();
                    ActionStartRecordingResponse response = client.calls().actions().startRecording(params);
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response = telnyx.calls.actions.start_recording("call_control_id",
            channels: :single, format_: :wav)


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
              $response = $client->calls->actions->startRecording(
                'call_control_id',
                channels: 'single',
                format: 'wav',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                customFileName: 'my_recording_file_name',
                maxLength: 0,
                playBeep: true,
                recordingTrack: 'outbound',
                timeoutSecs: 0,
                transcription: true,
                transcriptionEngine: 'B',
                transcriptionLanguage: 'en',
                transcriptionMaxSpeakerCount: 4,
                transcriptionMinSpeakerCount: 4,
                transcriptionProfanityFilter: true,
                transcriptionSpeakerDiarization: true,
                trim: 'trim-silence',
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions start-recording \
              --api-key 'My API Key' \
              --call-control-id call_control_id \
              --channels single \
              --format wav
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
    StartRecordingRequest:
      type: object
      title: Start Recording Request
      required:
        - format
        - channels
      properties:
        format:
          description: >-
            The audio file format used when storing the call recording. Can be
            either `mp3` or `wav`.
          type: string
          enum:
            - wav
            - mp3
          example: mp3
        channels:
          description: >-
            When `dual`, final audio file will be stereo recorded with the first
            leg on channel A, and the rest on channel B.
          enum:
            - single
            - dual
          type: string
          example: single
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
        play_beep:
          description: If enabled, a beep sound will be played at the start of a recording.
          type: boolean
          example: true
        max_length:
          description: >-
            Defines the maximum length for the recording in seconds. The minimum
            value is 0. The maximum value is 14400. The default value is 0
            (infinite)
          type: integer
          example: 100
          default: 0
          format: int32
        timeout_secs:
          description: >-
            The number of seconds that Telnyx will wait for the recording to be
            stopped if silence is detected. The timer only starts when the
            speech is detected. Please note that call transcription is used to
            detect silence and the related charge will be applied. The minimum
            value is 0. The default value is 0 (infinite)
          type: integer
          example: 100
          default: 0
          format: int32
        recording_track:
          description: >-
            The audio track to be recorded. Can be either `both`, `inbound` or
            `outbound`. If only single track is specified (`inbound`,
            `outbound`), `channels` configuration is ignored and it will be
            recorded as mono (single channel).
          type: string
          example: outbound
          default: both
          enum:
            - both
            - inbound
            - outbound
        trim:
          description: >-
            When set to `trim-silence`, silence will be removed from the
            beginning and end of the recording.
          enum:
            - trim-silence
          type: string
          example: trim-silence
        custom_file_name:
          description: >-
            The custom recording file name to be used instead of the default
            `call_leg_id`. Telnyx will still add a Unix timestamp suffix.
          type: string
          minLength: 1
          maxLength: 40
          example: my_recording_file_name
        transcription:
          description: Enable post recording transcription. The default value is false.
          type: boolean
          default: false
          example: true
        transcription_engine:
          description: >-
            Engine to use for speech recognition. `A` - `Google`, `B` -
            `Telnyx`, `deepgram/nova-3` - `Deepgram Nova-3`. Note:
            `deepgram/nova-3` supports only `en` and `en-{Region}` languages.
          type: string
          enum:
            - A
            - B
            - deepgram/nova-3
          default: A
          example: A
        transcription_language:
          $ref: '#/components/schemas/TranscriptionLanguage'
        transcription_profanity_filter:
          description: Enables profanity_filter. Applies to `google` engine only.
          type: boolean
          default: false
          example: true
        transcription_speaker_diarization:
          description: Enables speaker diarization. Applies to `google` engine only.
          type: boolean
          default: false
          example: true
        transcription_min_speaker_count:
          description: >-
            Defines minimum number of speakers in the conversation. Applies to
            `google` engine only.
          type: integer
          example: 4
          default: 2
          format: int32
        transcription_max_speaker_count:
          description: >-
            Defines maximum number of speakers in the conversation. Applies to
            `google` engine only.
          type: integer
          example: 4
          default: 6
          format: int32
      example:
        format: wav
        channels: single
        client_state: aGF2ZSBhIG5pY2UgZGF5ID1d
        command_id: 891510ac-f3e4-11e8-af5b-de00688a4901
        play_beep: true
        max_length: 0
        timeout_secs: 0
        transcription: true
        transcription_engine: B
        transcription_language: en
    CallControlCommandResult:
      type: object
      title: Call Control Command Result
      example:
        result: ok
      properties:
        result:
          type: string
          example: ok
    TranscriptionLanguage:
      title: Transcription Language
      type: string
      description: >-
        Language code for transcription. Note: Not all languages are supported
        by all transcription engines (google, telnyx, deepgram). See
        engine-specific documentation for supported values.
      example: en-US
      default: en-US
      enum:
        - af
        - af-ZA
        - am
        - am-ET
        - ar
        - ar-AE
        - ar-BH
        - ar-DZ
        - ar-EG
        - ar-IL
        - ar-IQ
        - ar-JO
        - ar-KW
        - ar-LB
        - ar-MA
        - ar-MR
        - ar-OM
        - ar-PS
        - ar-QA
        - ar-SA
        - ar-TN
        - ar-YE
        - as
        - auto_detect
        - az
        - az-AZ
        - ba
        - be
        - bg
        - bg-BG
        - bn
        - bn-BD
        - bn-IN
        - bo
        - br
        - bs
        - bs-BA
        - ca
        - ca-ES
        - cs
        - cs-CZ
        - cy
        - da
        - da-DK
        - de
        - de-AT
        - de-CH
        - de-DE
        - el
        - el-GR
        - en
        - en-AU
        - en-CA
        - en-GB
        - en-GH
        - en-HK
        - en-IE
        - en-IN
        - en-KE
        - en-NG
        - en-NZ
        - en-PH
        - en-PK
        - en-SG
        - en-TZ
        - en-US
        - en-ZA
        - es
        - es-419
        - es-AR
        - es-BO
        - es-CL
        - es-CO
        - es-CR
        - es-DO
        - es-EC
        - es-ES
        - es-GT
        - es-HN
        - es-MX
        - es-NI
        - es-PA
        - es-PE
        - es-PR
        - es-PY
        - es-SV
        - es-US
        - es-UY
        - es-VE
        - et
        - et-EE
        - eu
        - eu-ES
        - fa
        - fa-IR
        - fi
        - fi-FI
        - fil-PH
        - fo
        - fr
        - fr-BE
        - fr-CA
        - fr-CH
        - fr-FR
        - gl
        - gl-ES
        - gu
        - gu-IN
        - ha
        - haw
        - he
        - hi
        - hi-IN
        - hr
        - hr-HR
        - ht
        - hu
        - hu-HU
        - hy
        - hy-AM
        - id
        - id-ID
        - is
        - is-IS
        - it
        - it-CH
        - it-IT
        - iw-IL
        - ja
        - ja-JP
        - jv-ID
        - jw
        - ka
        - ka-GE
        - kk
        - kk-KZ
        - km
        - km-KH
        - kn
        - kn-IN
        - ko
        - ko-KR
        - la
        - lb
        - ln
        - lo
        - lo-LA
        - lt
        - lt-LT
        - lv
        - lv-LV
        - mg
        - mi
        - mk
        - mk-MK
        - ml
        - ml-IN
        - mn
        - mn-MN
        - mr
        - mr-IN
        - ms
        - ms-MY
        - mt
        - my
        - my-MM
        - ne
        - ne-NP
        - nl
        - nl-BE
        - nl-NL
        - nn
        - 'no'
        - no-NO
        - oc
        - pa
        - pa-Guru-IN
        - pl
        - pl-PL
        - ps
        - pt
        - pt-BR
        - pt-PT
        - ro
        - ro-RO
        - ru
        - ru-RU
        - rw-RW
        - sa
        - sd
        - si
        - si-LK
        - sk
        - sk-SK
        - sl
        - sl-SI
        - sn
        - so
        - sq
        - sq-AL
        - sr
        - sr-RS
        - ss-latn-za
        - st-ZA
        - su
        - su-ID
        - sv
        - sv-SE
        - sw
        - sw-KE
        - sw-TZ
        - ta
        - ta-IN
        - ta-LK
        - ta-MY
        - ta-SG
        - te
        - te-IN
        - tg
        - th
        - th-TH
        - tk
        - tl
        - tn-latn-za
        - tr
        - tr-TR
        - ts-ZA
        - tt
        - uk
        - uk-UA
        - ur
        - ur-IN
        - ur-PK
        - uz
        - uz-UZ
        - ve-ZA
        - vi
        - vi-VN
        - xh-ZA
        - yi
        - yo
        - yue-Hant-HK
        - zh
        - zh-TW
        - zu-ZA
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
