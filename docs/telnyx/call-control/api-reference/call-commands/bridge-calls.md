---
title: "Bridge calls"
source_url: "https://developers.telnyx.com/api-reference/call-commands/bridge-calls.md"
category: "call-control"
synced_at: "2026-06-25T18:43:09.217Z"
content_hash: "0b2043a9849372c6237143e1034fca26fac39e686cbb74b9c35bb84b3d043d2e"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Bridge calls

> Bridge two call control calls.

**Expected Webhooks:**

- `call.bridged` for Leg A
- `call.bridged` for Leg B




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/bridge.yml post /calls/{call_control_id}/actions/bridge
openapi: 3.1.0
info:
  title: Telnyx Call Control - Bridge
  version: 2.0.0
  description: API for bridging calls.
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
  /calls/{call_control_id}/actions/bridge:
    post:
      tags:
        - Call Commands
      summary: Bridge calls
      description: |
        Bridge two call control calls.

        **Expected Webhooks:**

        - `call.bridged` for Leg A
        - `call.bridged` for Leg B
      operationId: BridgeCall
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Bridge call request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BridgeRequest'
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
            client.calls.actions.bridge('call_control_id', {
              call_control_id_to_bridge_with: 'v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg',
            });


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.bridge(
                call_control_id_to_bridge="call_control_id",
                call_control_id_to_bridge_with="v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.Bridge(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionBridgeParams{\n\t\t\tCallControlIDToBridgeWith: \"v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg\",\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.calls.actions.ActionBridgeParams;
            import com.telnyx.sdk.models.calls.actions.ActionBridgeResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionBridgeParams params = ActionBridgeParams.builder()
                        .callControlIdToBridge("call_control_id")
                        .callControlId("v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg")
                        .build();
                    ActionBridgeResponse response = client.calls().actions().bridge(params);
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            response = telnyx.calls.actions.bridge(
              "call_control_id",
              call_control_id_to_bridge_with: "v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg"
            )

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
              $response = $client->calls->actions->bridge(
                'call_control_id',
                callControlIDToBridgeWith: 'v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                holdAfterUnbridge: true,
                muteDtmf: 'opposite',
                parkAfterUnbridge: 'self',
                playRingtone: true,
                preventDoubleBridge: true,
                queue: 'support',
                record: 'record-from-answer',
                recordChannels: 'single',
                recordCustomFileName: 'my_recording_file_name',
                recordFormat: 'wav',
                recordMaxLength: 1000,
                recordTimeoutSecs: 100,
                recordTrack: 'outbound',
                recordTrim: 'trim-silence',
                ringtone: 'pl',
                videoRoomContext: 'Alice',
                videoRoomID: '0ccc7b54-4df3-4bca-a65a-3da1ecc777f0',
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions bridge \
              --api-key 'My API Key' \
              --call-control-id-to-bridge call_control_id \
              --call-control-id-to-bridge-with v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg
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
    BridgeRequest:
      type: object
      title: Bridge Request
      required:
        - call_control_id
      properties:
        call_control_id:
          description: >-
            The Call Control ID of the call you want to bridge with, can't be
            used together with queue parameter or video_room_id parameter.
          type: string
          example: v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg
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
        queue:
          description: >-
            The name of the queue you want to bridge with, can't be used
            together with call_control_id parameter or video_room_id parameter.
            Bridging with a queue means bridging with the first call in the
            queue. The call will always be removed from the queue regardless of
            whether bridging succeeds. Returns an error when the queue is empty.
          type: string
          example: support
        video_room_id:
          description: >-
            The ID of the video room you want to bridge with, can't be used
            together with call_control_id parameter or queue parameter.
          type: string
          format: uuid
          example: 0ccc7b54-4df3-4bca-a65a-3da1ecc777f0
        video_room_context:
          description: >-
            The additional parameter that will be passed to the video
            conference. It is a text field and the user can decide how to use
            it. For example, you can set the participant name or pass JSON text.
            It can be used only with video_room_id parameter.
          type: string
          example: Alice
        prevent_double_bridge:
          description: >-
            When set to `true`, it prevents bridging if the target call is
            already bridged to another call. Disabled by default.
          type: boolean
          default: false
          example: true
        park_after_unbridge:
          description: >-
            Specifies behavior after the bridge ends (i.e. the opposite leg
            either hangs up or is transferred). If supplied with the value
            `self`, the current leg will be parked after unbridge. If not set,
            the default behavior is to hang up the leg.
          type: string
          example: self
        play_ringtone:
          description: >-
            Specifies whether to play a ringtone if the call you want to bridge
            with has not yet been answered.
          type: boolean
          default: false
          example: true
        ringtone:
          description: >-
            Specifies which country ringtone to play when `play_ringtone` is set
            to `true`. If not set, the US ringtone will be played.
          type: string
          default: us
          example: pl
          enum:
            - at
            - au
            - be
            - bg
            - br
            - ch
            - cl
            - cn
            - cz
            - de
            - dk
            - ee
            - es
            - fi
            - fr
            - gr
            - hu
            - il
            - in
            - it
            - jp
            - lt
            - mx
            - my
            - nl
            - 'no'
            - nz
            - ph
            - pl
            - pt
            - ru
            - se
            - sg
            - th
            - tw
            - uk
            - us-old
            - us
            - ve
            - za
        record:
          description: Start recording automatically after an event. Disabled by default.
          type: string
          enum:
            - record-from-answer
          example: record-from-answer
        record_channels:
          description: >-
            Defines which channel should be recorded ('single' or 'dual') when
            `record` is specified.
          type: string
          enum:
            - single
            - dual
          default: dual
          example: single
        record_format:
          description: >-
            Defines the format of the recording ('wav' or 'mp3') when `record`
            is specified.
          type: string
          enum:
            - wav
            - mp3
          default: mp3
          example: wav
        record_max_length:
          description: >-
            Defines the maximum length for the recording in seconds when
            `record` is specified. The minimum value is 0. The maximum value is
            43200. The default value is 0 (infinite).
          type: integer
          format: int32
          default: 0
          example: 1000
        record_timeout_secs:
          description: >-
            The number of seconds that Telnyx will wait for the recording to be
            stopped if silence is detected when `record` is specified. The timer
            only starts when the speech is detected. Please note that call
            transcription is used to detect silence and the related charge will
            be applied. The minimum value is 0. The default value is 0
            (infinite).
          type: integer
          format: int32
          default: 0
          example: 100
        record_track:
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
        record_trim:
          description: >-
            When set to `trim-silence`, silence will be removed from the
            beginning and end of the recording.
          enum:
            - trim-silence
          type: string
          example: trim-silence
        record_custom_file_name:
          description: >-
            The custom recording file name to be used instead of the default
            `call_leg_id`. Telnyx will still add a Unix timestamp suffix.
          type: string
          minLength: 1
          maxLength: 40
          example: my_recording_file_name
        mute_dtmf:
          description: >-
            When enabled, DTMF tones are not passed to the call participant. The
            webhooks containing the DTMF information will be sent.
          type: string
          enum:
            - none
            - both
            - self
            - opposite
          default: none
          example: opposite
        hold_after_unbridge:
          description: >-
            Specifies behavior after the bridge ends. If set to `true`, the
            current leg will be put on hold after unbridge instead of being hung
            up.
          type: boolean
          example: true
      example:
        call_control_id: v3:MdI91X4lWFEs7IgbBEOT9M4AigoY08M0WWZFISt1Yw2axZ_IiE4pqg
        client_state: aGF2ZSBhIG5pY2UgZGF5ID1d
        command_id: 891510ac-f3e4-11e8-af5b-de00688a4901
        park_after_unbridge: self
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
