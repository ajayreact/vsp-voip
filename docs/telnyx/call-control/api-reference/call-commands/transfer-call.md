---
title: "Transfer call"
source_url: "https://developers.telnyx.com/api-reference/call-commands/transfer-call.md"
category: "transfers"
synced_at: "2026-06-25T18:43:16.196Z"
content_hash: "a356b08cf334ad9da007cb11d255f3bc6a53091f17a1d2e0d9db917fd783f9a8"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Transfer call

> Transfer a call to a new destination. If the transfer is unsuccessful, a `call.hangup` webhook for the other call (Leg B) will be sent indicating that the transfer could not be completed. The original call will remain active and may be issued additional commands, potentially transfering the call to an alternate destination.

**Expected Webhooks:**

- `call.initiated`
- `call.bridged` to Leg B
- `call.answered` or `call.hangup`
- `call.machine.detection.ended` if `answering_machine_detection` was requested
- `call.machine.greeting.ended` if `answering_machine_detection` was requested to detect the end of machine greeting
- `call.machine.premium.detection.ended` if `answering_machine_detection=premium` was requested
- `call.machine.premium.greeting.ended` if `answering_machine_detection=premium` was requested and a beep was detected




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/transfer.yml post /calls/{call_control_id}/actions/transfer
openapi: 3.1.0
info:
  title: Telnyx Call Control - Transfer
  version: 2.0.0
  description: API for transferring a call.
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
  /calls/{call_control_id}/actions/transfer:
    post:
      tags:
        - Call Commands
      summary: Transfer call
      description: >
        Transfer a call to a new destination. If the transfer is unsuccessful, a
        `call.hangup` webhook for the other call (Leg B) will be sent indicating
        that the transfer could not be completed. The original call will remain
        active and may be issued additional commands, potentially transfering
        the call to an alternate destination.


        **Expected Webhooks:**


        - `call.initiated`

        - `call.bridged` to Leg B

        - `call.answered` or `call.hangup`

        - `call.machine.detection.ended` if `answering_machine_detection` was
        requested

        - `call.machine.greeting.ended` if `answering_machine_detection` was
        requested to detect the end of machine greeting

        - `call.machine.premium.detection.ended` if
        `answering_machine_detection=premium` was requested

        - `call.machine.premium.greeting.ended` if
        `answering_machine_detection=premium` was requested and a beep was
        detected
      operationId: TransferCall
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Transfer call request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransferCallRequest'
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
            client.calls.actions.transfer('call_control_id', {
              to: '+18005550100 or sip:username@sip.telnyx.com;secure=srtp',
            });


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.transfer(
                call_control_id="call_control_id",
                to="+18005550100 or sip:username@sip.telnyx.com;secure=srtp",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.Transfer(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionTransferParams{\n\t\t\tTo: \"+18005550100 or sip:username@sip.telnyx.com;secure=srtp\",\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.calls.actions.ActionTransferParams;
            import com.telnyx.sdk.models.calls.actions.ActionTransferResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionTransferParams params = ActionTransferParams.builder()
                        .callControlId("call_control_id")
                        .to("+18005550100 or sip:username@sip.telnyx.com;secure=srtp")
                        .build();
                    ActionTransferResponse response = client.calls().actions().transfer(params);
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            response = telnyx.calls.actions.transfer(
              "call_control_id",
              to: "+18005550100 or sip:username@sip.telnyx.com;secure=srtp"
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
              $response = $client->calls->actions->transfer(
                'call_control_id',
                to: '+18005550100 or sip:username@sip.telnyx.com;secure=srtp',
                answeringMachineDetection: 'detect',
                answeringMachineDetectionConfig: [
                  'afterGreetingSilenceMillis' => 1000,
                  'betweenWordsSilenceMillis' => 1000,
                  'greetingDurationMillis' => 1000,
                  'greetingSilenceDurationMillis' => 2000,
                  'greetingTotalAnalysisTimeMillis' => 50000,
                  'initialSilenceMillis' => 1000,
                  'maximumNumberOfWords' => 1000,
                  'maximumWordLengthMillis' => 2000,
                  'silenceThreshold' => 512,
                  'totalAnalysisTimeMillis' => 5000,
                ],
                audioURL: 'http://www.example.com/sounds/greeting.wav',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                customHeaders: [
                  ['name' => 'head_1', 'value' => 'val_1'],
                  ['name' => 'head_2', 'value' => 'val_2'],
                ],
                earlyMedia: true,
                from: '+18005550101',
                fromDisplayName: 'Company Name',
                mediaEncryption: 'SRTP',
                mediaName: 'my_media_uploaded_to_media_storage_api',
                muteDtmf: 'opposite',
                parkAfterUnbridge: 'self',
                preferredCodecs: 'G722,PCMU,PCMA,G729,OPUS,VP8,H264',
                privacy: 'id',
                record: 'record-from-answer',
                recordChannels: 'single',
                recordCustomFileName: 'my_recording_file_name',
                recordFormat: 'wav',
                recordMaxLength: 1000,
                recordTimeoutSecs: 100,
                recordTrack: 'outbound',
                recordTrim: 'trim-silence',
                sendDigitsOnAnswer: 'wwww200',
                sipAuthPassword: 'password',
                sipAuthUsername: 'username',
                sipHeaders: [['name' => 'User-to-User', 'value' => 'value']],
                sipRegion: 'Canada',
                sipTransportProtocol: 'TLS',
                soundModifications: [
                  'octaves' => 0.1, 'pitch' => 0.8, 'semitone' => -2, 'track' => 'both'
                ],
                targetLegClientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                timeLimitSecs: 60,
                timeoutSecs: 60,
                webhookRetriesPolicies: [
                  'call.answered' => ['retriesMs' => [1000, 2000, 5000]]
                ],
                webhookURL: 'https://www.example.com/server-b/',
                webhookURLMethod: 'POST',
                webhookURLs: [
                  'call.answered' => 'https://www.example.com/webhooks/answered',
                  'call.hangup' => 'https://www.example.com/webhooks/hangup',
                ],
                webhookURLsMethod: 'POST',
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions transfer \
              --api-key 'My API Key' \
              --call-control-id call_control_id \
              --to '+18005550100 or sip:username@sip.telnyx.com;secure=srtp'
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
    TransferCallRequest:
      type: object
      title: Transfer Call Request
      required:
        - to
      example:
        to: +18005550100 or sip:username@sip.telnyx.com;secure=srtp
        from: '+18005550101'
        from_display_name: Company Name
        audio_url: http://www.example.com/sounds/greeting.wav
        send_digits_on_answer: wwww200
        timeout_secs: 60
        time_limit_secs: 60
        webhook_url: https://www.example.com/server-b/
        webhook_url_method: POST
        answering_machine_detection: detect
        answering_machine_detection_config:
          total_analysis_time_millis: 5000
          after_greeting_silence_millis: 1000
          between_words_silence_millis: 1000
          greeting_duration_millis: 1000
          initial_silence_millis: 1000
          maximum_number_of_words: 1000
          maximum_word_length_millis: 2000
          silence_threshold: 512
          greeting_total_analysis_time_millis: 50000
          greeting_silence_duration_millis: 2000
        custom_headers:
          - name: head_1
            value: val_1
          - name: head_2
            value: val_2
        client_state: aGF2ZSBhIG5pY2UgZGF5ID1d
        command_id: 891510ac-f3e4-11e8-af5b-de00688a4901
        early_media: true
        media_encryption: SRTP
        sip_auth_username: username
        sip_auth_password: password
        sip_headers:
          - name: User-to-User
            value: value
        sip_transport_protocol: TLS
      properties:
        to:
          description: >-
            The DID or SIP URI to dial out to. For SIP URI destinations, append
            `;secure=true` or `;secure=srtp` to enable SRTP media encryption for
            that endpoint, or `;secure=dtls` to enable DTLS media encryption for
            that endpoint. If `media_encryption` is set to `SRTP` or `DTLS`, it
            takes precedence over any per-endpoint `secure` URI parameter. You
            may also append a comma followed by DTMF digits (e.g.
            `+18004247767,200`) to play those digits as DTMF once the transfer
            destination answers — equivalent to setting `send_digits_on_answer`
            separately. If both are present, the explicit
            `send_digits_on_answer` parameter takes precedence.
          type: string
          example: +18005550100 or sip:username@sip.telnyx.com;secure=srtp
        from:
          description: >-
            The `from` number to be used as the caller id presented to the
            destination (`to` number). The number should be in +E164 format.
            This attribute will default to the `to` number of the original call
            if omitted.
          type: string
          example: '+18005550101'
        from_display_name:
          description: >-
            The `from_display_name` string to be used as the caller id name (SIP
            From Display Name) presented to the destination (`to` number). The
            string should have a maximum of 128 characters, containing only
            letters, numbers, spaces, and -_~!.+ special characters. If ommited,
            the display name will be the same as the number in the `from` field.
          type: string
          example: Company Name
        privacy:
          type: string
          description: >-
            Indicates the privacy level to be used for the call. When set to
            `id`, caller ID information (name and number) will be hidden from
            the called party. When set to `none` or omitted, caller ID will be
            shown normally.
          enum:
            - id
            - none
          example: id
        audio_url:
          type: string
          example: http://example.com/message.wav
          description: >-
            The URL of a file to be played back when the transfer destination
            answers before bridging the call. The URL can point to either a WAV
            or MP3 file. media_name and audio_url cannot be used together in one
            request.
        send_digits_on_answer:
          type: string
          example: wwww200
          description: >-
            DTMF digits to send automatically after the transfer destination
            answers. Useful for reaching an extension behind an IVR (e.g.
            `"200"` to dial extension 200 once the called party picks up).
            Allowed characters: `0-9`, `A-D`, `w` (0.5s pause), `W` (1s pause),
            `*`, `#`. Maximum 64 characters. When omitted, no automatic DTMF is
            sent. May also be supplied inline by appending `,<digits>` to `to`
            (e.g. `to=+18004247767,200`); if both forms are present, this
            explicit field takes precedence.
        early_media:
          type: boolean
          default: true
          example: false
          description: >-
            If set to false, early media will not be passed to the originating
            leg.
        media_name:
          type: string
          example: my_media_uploaded_to_media_storage_api
          description: >-
            The media_name of a file to be played back when the transfer
            destination answers before bridging the call. The media_name must
            point to a file previously uploaded to api.telnyx.com/v2/media by
            the same user/organization. The file must either be a WAV or MP3
            file.
        timeout_secs:
          description: >-
            The number of seconds that Telnyx will wait for the call to be
            answered by the destination to which it is being transferred. If the
            timeout is reached before an answer is received, the call will
            hangup and a `call.hangup` webhook with a `hangup_cause` of
            `timeout` will be sent. Minimum value is 5 seconds. Maximum value is
            600 seconds.
          default: 30
          type: integer
          example: 60
          format: int32
        time_limit_secs:
          description: >-
            Sets the maximum duration of a Call Control Leg in seconds. If the
            time limit is reached, the call will hangup and a `call.hangup`
            webhook with a `hangup_cause` of `time_limit` will be sent. For
            example, by setting a time limit of 120 seconds, a Call Leg will be
            automatically terminated two minutes after being answered. The
            default time limit is 14400 seconds or 4 hours and this is also the
            maximum allowed call length.
          default: 14400
          type: integer
          example: 600
          format: int32
          minimum: 30
          maximum: 14400
        park_after_unbridge:
          description: >-
            Specifies behavior after the bridge ends (i.e. the opposite leg
            either hangs up or is transferred). If supplied with the value
            `self`, the current leg will be parked after unbridge. If not set,
            the default behavior is to hang up the leg.
          type: string
          example: self
        answering_machine_detection:
          description: >-
            Enables Answering Machine Detection. When a call is answered, Telnyx
            runs real-time detection to determine if it was picked up by a human
            or a machine and sends an `call.machine.detection.ended` webhook
            with the analysis result. If 'greeting_end' or 'detect_words' is
            used and a 'machine' is detected, you will receive another
            'call.machine.greeting.ended' webhook when the answering machine
            greeting ends with a beep or silence. If `detect_beep` is used, you
            will only receive 'call.machine.greeting.ended' if a beep is
            detected.
          default: disabled
          type: string
          enum:
            - premium
            - detect
            - detect_beep
            - detect_words
            - greeting_end
            - disabled
        answering_machine_detection_config:
          description: >-
            Optional configuration parameters to modify
            'answering_machine_detection' performance. Only
            `total_analysis_time_millis` and `greeting_duration_millis`
            parameters are applicable when `premium` is selected as
            answering_machine_detection.
          type: object
          properties:
            total_analysis_time_millis:
              description: Maximum timeout threshold for overall detection.
              default: 3500
              type: integer
              example: 5000
              format: int32
            after_greeting_silence_millis:
              description: >-
                Silence duration threshold after a greeting message or voice for
                it be considered human.
              default: 800
              type: integer
              example: 1000
              format: int32
            between_words_silence_millis:
              description: Maximum threshold for silence between words.
              default: 50
              type: integer
              example: 100
              format: int32
            greeting_duration_millis:
              description: >-
                Maximum threshold of a human greeting. If greeting longer than
                this value, considered machine.
              default: 3500
              type: integer
              example: 1500
              format: int32
            initial_silence_millis:
              description: >-
                If initial silence duration is greater than this value, consider
                it a machine.
              default: 3500
              type: integer
              example: 1800
              format: int32
            maximum_number_of_words:
              description: >-
                If number of detected words is greater than this value, consder
                it a machine.
              default: 5
              type: integer
              example: 3
              format: int32
            maximum_word_length_millis:
              description: >-
                If a single word lasts longer than this threshold, consider it a
                machine.
              default: 3500
              type: integer
              example: 2000
              format: int32
            silence_threshold:
              description: Minimum noise threshold for any analysis.
              default: 256
              type: integer
              example: 512
              format: int32
            greeting_total_analysis_time_millis:
              description: >-
                If machine already detected, maximum timeout threshold to
                determine the end of the machine greeting.
              default: 5000
              type: integer
              example: 7500
              format: int32
            greeting_silence_duration_millis:
              description: >-
                If machine already detected, maximum threshold for silence
                between words. If exceeded, the greeting is considered ended.
              default: 1500
              type: integer
              example: 2000
              format: int32
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
        client_state:
          description: >-
            Use this field to add state to every subsequent webhook. It must be
            a valid Base-64 encoded string.
          type: string
          example: aGF2ZSBhIG5pY2UgZGF5ID1d
        target_leg_client_state:
          description: >-
            Use this field to add state to every subsequent webhook for the new
            leg. It must be a valid Base-64 encoded string.
          type: string
          example: aGF2ZSBhIG5pY2UgZGF5ID1d
        command_id:
          description: >-
            Use this field to avoid duplicate commands. Telnyx will ignore any
            command with the same `command_id` for the same `call_control_id`.
          type: string
          example: 891510ac-f3e4-11e8-af5b-de00688a4901
        media_encryption:
          description: >-
            Defines whether media should be encrypted on the new call leg. For
            SIP URI destinations, media encryption can also be requested per
            endpoint with the `secure` URI parameter: `;secure=true` or
            `;secure=srtp` enables SRTP, and `;secure=dtls` enables DTLS. This
            parameter, when set to `SRTP` or `DTLS`, takes precedence over the
            per-endpoint `secure` value.
          default: disabled
          type: string
          enum:
            - disabled
            - SRTP
            - DTLS
        sip_auth_username:
          description: SIP Authentication username used for SIP challenges.
          type: string
          example: username
        sip_auth_password:
          description: SIP Authentication password used for SIP challenges.
          type: string
          example: password
        sip_headers:
          description: >-
            SIP headers to be added to the SIP INVITE. Currently only
            User-to-User header is supported.
          type: array
          example:
            - name: User-to-User
              value: value
          items:
            $ref: '#/components/schemas/SipHeader'
        sip_transport_protocol:
          description: Defines SIP transport protocol to be used on the call.
          default: UDP
          type: string
          enum:
            - UDP
            - TCP
            - TLS
        sound_modifications:
          $ref: '#/components/schemas/SoundModifications'
        webhook_url:
          description: >-
            Use this field to override the URL for which Telnyx will send
            subsequent webhooks to for this call.
          type: string
          example: https://www.example.com/server-b/
        webhook_url_method:
          description: HTTP request type used for `webhook_url`.
          default: POST
          type: string
          enum:
            - POST
            - GET
          example: GET
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
        sip_region:
          description: Defines the SIP region to be used for the call.
          type: string
          default: US
          enum:
            - US
            - Europe
            - Canada
            - Australia
            - Middle East
          example: Canada
        preferred_codecs:
          description: >-
            The list of comma-separated codecs in order of preference to be used
            during the call. The codecs supported are `G722`, `PCMU`, `PCMA`,
            `G729`, `OPUS`, `VP8`, `H264`, `AMR-WB`.
          type: string
          example: G722,PCMU,PCMA,G729,OPUS,VP8,H264
        webhook_urls:
          description: >-
            A map of event types to webhook URLs. When an event of the specified
            type occurs, the webhook URL associated with that event type will be
            called instead of `webhook_url`. Events not mapped here will use the
            default `webhook_url`.
          type: object
          additionalProperties:
            type: string
            format: uri
          example:
            call.answered: https://www.example.com/webhooks/answered
            call.hangup: https://www.example.com/webhooks/hangup
        webhook_urls_method:
          description: HTTP request method to invoke `webhook_urls`.
          type: string
          enum:
            - POST
            - GET
          default: POST
          example: POST
        webhook_retries_policies:
          description: >-
            A map of event types to retry policies. Each retry policy contains
            an array of `retries_ms` specifying the delays between retry
            attempts in milliseconds. Maximum 5 retries, total delay cannot
            exceed 60 seconds.
          type: object
          additionalProperties:
            type: object
            properties:
              retries_ms:
                type: array
                items:
                  type: integer
                maxItems: 5
                description: >-
                  Array of delays in milliseconds between retry attempts. Total
                  sum cannot exceed 60000ms.
          example:
            call.answered:
              retries_ms:
                - 1000
                - 2000
                - 5000
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
    SoundModifications:
      type: object
      title: Sound modifications
      description: Use this field to modify sound effects, for example adjust the pitch.
      properties:
        pitch:
          description: >-
            Set the pitch directly, value should be > 0, default 1 (lower =
            lower tone)
          type: number
          format: float
          example: 0.8
        semitone:
          description: >-
            Adjust the pitch in semitones, values should be between -14 and 14,
            default 0
          type: number
          format: float
          example: -10
        octaves:
          description: >-
            Adjust the pitch in octaves, values should be between -1 and 1,
            default 0
          type: number
          format: float
          example: -0.5
        track:
          description: >-
            The track to which the sound modifications will be applied. Accepted
            values are `inbound` or `outbound`
          type: string
          example: inbound
          default: outbound
      example:
        pitch: 0.8
        semitone: -2
        octaves: 0.1
        track: both
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
