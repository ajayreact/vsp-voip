---
title: "SIP Refer a call"
source_url: "https://developers.telnyx.com/api-reference/call-commands/sip-refer-a-call.md"
category: "sip"
synced_at: "2026-06-25T18:43:14.043Z"
content_hash: "a21e66b6c4d58e8bfe2a1bd380b930e3628948d24a4a182680112dd2116fa616"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# SIP Refer a call

> Initiate a SIP Refer on a Call Control call. You can initiate a SIP Refer at any point in the duration of a call.

**Expected Webhooks:**

- `call.refer.started`
- `call.refer.completed`
- `call.refer.failed`




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/refer.yml post /calls/{call_control_id}/actions/refer
openapi: 3.1.0
info:
  title: Telnyx Call Control - Refer
  version: 2.0.0
  description: API for SIP REFER.
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
  /calls/{call_control_id}/actions/refer:
    post:
      tags:
        - Call Commands
      summary: SIP Refer a call
      description: >
        Initiate a SIP Refer on a Call Control call. You can initiate a SIP
        Refer at any point in the duration of a call.


        **Expected Webhooks:**


        - `call.refer.started`

        - `call.refer.completed`

        - `call.refer.failed`
      operationId: ReferCall
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Refer request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReferRequest'
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


            const response = await client.calls.actions.refer('call_control_id',
            {
              sip_address: 'sip:username@sip.non-telnyx-address.com',
            });


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.refer(
                call_control_id="call_control_id",
                sip_address="sip:username@sip.non-telnyx-address.com",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.Refer(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionReferParams{\n\t\t\tSipAddress: \"sip:username@sip.non-telnyx-address.com\",\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.calls.actions.ActionReferParams;
            import com.telnyx.sdk.models.calls.actions.ActionReferResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionReferParams params = ActionReferParams.builder()
                        .callControlId("call_control_id")
                        .sipAddress("sip:username@sip.non-telnyx-address.com")
                        .build();
                    ActionReferResponse response = client.calls().actions().refer(params);
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response = telnyx.calls.actions.refer("call_control_id",
            sip_address: "sip:username@sip.non-telnyx-address.com")


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
              $response = $client->calls->actions->refer(
                'call_control_id',
                sipAddress: 'sip:username@sip.non-telnyx-address.com',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                customHeaders: [
                  ['name' => 'head_1', 'value' => 'val_1'],
                  ['name' => 'head_2', 'value' => 'val_2'],
                ],
                sipAuthPassword: 'sip_auth_password',
                sipAuthUsername: 'sip_auth_username',
                sipHeaders: [['name' => 'User-to-User', 'value' => 'value']],
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions refer \
              --api-key 'My API Key' \
              --call-control-id call_control_id \
              --sip-address sip:username@sip.non-telnyx-address.com
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
    ReferRequest:
      type: object
      title: Refer request
      required:
        - sip_address
      properties:
        sip_address:
          description: The SIP URI to which the call will be referred to.
          type: string
          example: sip:username@sip.non-telnyx-address.com
        client_state:
          description: >-
            Use this field to add state to every subsequent webhook. It must be
            a valid Base-64 encoded string.
          example: aGF2ZSBhIG5pY2UgZGF5ID1d
          type: string
        command_id:
          description: >-
            Use this field to avoid execution of duplicate commands. Telnyx will
            ignore subsequent commands with the same `command_id` as one that
            has already been executed.
          example: 891510ac-f3e4-11e8-af5b-de00688a4901
          type: string
        custom_headers:
          description: Custom headers to be added to the SIP INVITE.
          type: array
          example:
            - name: head_1
              value: val_1
            - name: head_2
              value: val_2
          items:
            $ref: '#/components/schemas/CustomSipHeader'
        sip_auth_username:
          description: SIP Authentication username used for SIP challenges.
          type: string
        sip_auth_password:
          description: SIP Authentication password used for SIP challenges.
          type: string
        sip_headers:
          description: >-
            SIP headers to be added to the request. Currently only User-to-User
            header is supported.
          type: array
          example:
            - name: User-to-User
              value: value
          items:
            $ref: '#/components/schemas/SipHeader'
      example:
        sip_address: sip:username@sip.non-telnyx-address.com
    CallControlCommandResult:
      type: object
      title: Call Control Command Result
      example:
        result: ok
      properties:
        result:
          type: string
          example: ok
    CustomSipHeader:
      type: object
      title: Custom SIP Header
      required:
        - name
        - value
      properties:
        name:
          description: The name of the header to add.
          type: string
          example: head_1
        value:
          description: The value of the header.
          type: string
          example: val_1
      example:
        name: head_1
        value: val_1
    SipHeader:
      type: object
      title: SIP Header
      required:
        - name
        - value
      properties:
        name:
          description: The name of the header to add.
          type: string
          enum:
            - User-to-User
          example: User-to-User
        value:
          description: The value of the header.
          type: string
          example: value
      example:
        name: User-to-User
        value: value
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
