---
title: "SIPREC start"
source_url: "https://developers.telnyx.com/api-reference/call-commands/siprec-start.md"
category: "sip"
synced_at: "2026-06-25T18:43:14.349Z"
content_hash: "ad0afb3da9f4578cf198fa6481b787f78a55b914828051d8e4693b14920dc6fc"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# SIPREC start

> Start siprec session to configured in SIPREC connector SRS. 

**Expected Webhooks:**

- `siprec.started`
- `siprec.stopped`
- `siprec.failed`




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/siprec-start.yml post /calls/{call_control_id}/actions/siprec_start
openapi: 3.1.0
info:
  title: Telnyx Call Control - SIPREC Start
  version: 2.0.0
  description: API for starting SIPREC.
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
  /calls/{call_control_id}/actions/siprec_start:
    post:
      tags:
        - Call Commands
      summary: SIPREC start
      description: |
        Start siprec session to configured in SIPREC connector SRS. 

        **Expected Webhooks:**

        - `siprec.started`
        - `siprec.stopped`
        - `siprec.failed`
      operationId: StartSiprecSession
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Start siprec session to configured in SIPREC connector SRS.
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/StartSiprecRequest'
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
            client.calls.actions.startSiprec('call_control_id');


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.start_siprec(
                call_control_id="call_control_id",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.StartSiprec(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionStartSiprecParams{},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import com.telnyx.sdk.models.calls.actions.ActionStartSiprecParams;

            import
            com.telnyx.sdk.models.calls.actions.ActionStartSiprecResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionStartSiprecResponse response = client.calls().actions().startSiprec("call_control_id");
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            response = telnyx.calls.actions.start_siprec("call_control_id")

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
              $response = $client->calls->actions->startSiprec(
                'call_control_id',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                connectorName: 'my-siprec-connector',
                includeMetadataCustomHeaders: true,
                secure: true,
                sessionTimeoutSecs: 900,
                sipTransport: 'tcp',
                siprecTrack: 'both_tracks',
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions start-siprec \
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
    StartSiprecRequest:
      type: object
      title: Start Siprec Request
      properties:
        connector_name:
          description: Name of configured SIPREC connector to be used.
          type: string
          example: my-siprec-connector
        sip_transport:
          description: Specifies SIP transport protocol.
          type: string
          enum:
            - udp
            - tcp
            - tls
          default: udp
          example: tcp
        siprec_track:
          description: Specifies which track should be sent on siprec session.
          type: string
          enum:
            - inbound_track
            - outbound_track
            - both_tracks
          default: both_tracks
          example: outbound_track
        include_metadata_custom_headers:
          description: >-
            When set, custom parameters will be added as metadata
            (recording.session.ExtensionParameters). Otherwise, they’ll be added
            to sip headers.
          example: true
          type: boolean
          enum:
            - true
            - false
        secure:
          description: >-
            Controls whether to encrypt media sent to your SRS using SRTP and
            TLS. When set you need to configure SRS port in your connector to
            5061.
          example: true
          type: boolean
          enum:
            - true
            - false
        session_timeout_secs:
          description: >-
            Sets `Session-Expires` header to the INVITE. A reinvite is sent
            every half the value set. Usefull for session keep alive. Minimum
            value is 90, set to 0 to disable.
          example: 900
          type: integer
          default: 1800
        client_state:
          description: >-
            Use this field to add state to every subsequent webhook. It must be
            a valid Base-64 encoded string.
          type: string
          example: aGF2ZSBhIG5pY2UgZGF5ID1d
      example:
        connector_name: my-siprec-connector
        siprec_track: both_tracks
        client_state: aGF2ZSBhIG5pY2UgZGF5ID1d
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
