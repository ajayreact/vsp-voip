---
title: "Speak text"
source_url: "https://developers.telnyx.com/api-reference/call-commands/speak-text.md"
category: "call-control"
synced_at: "2026-06-25T18:43:14.799Z"
content_hash: "f85753316113a90b461c7c7083a453ddd8ce48ef98dbcdd234bae1f3b7583f6f"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Speak text

> Convert text to speech and play it back on the call. If multiple speak text commands are issued consecutively, the audio files will be placed in a queue awaiting playback.

**Expected Webhooks:**

- `call.speak.started`
- `call.speak.ended`




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/speak.yml post /calls/{call_control_id}/actions/speak
openapi: 3.1.0
info:
  title: Telnyx Call Control - Speak
  version: 2.0.0
  description: API for text-to-speech on a call.
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
  /calls/{call_control_id}/actions/speak:
    post:
      tags:
        - Call Commands
      summary: Speak text
      description: >
        Convert text to speech and play it back on the call. If multiple speak
        text commands are issued consecutively, the audio files will be placed
        in a queue awaiting playback.


        **Expected Webhooks:**


        - `call.speak.started`

        - `call.speak.ended`
      operationId: SpeakCall
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Speak request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SpeakRequest'
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


            const response = await client.calls.actions.speak('call_control_id',
            {
              payload: 'Say this on the call',
              voice: 'female',
            });


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.speak(
                call_control_id="call_control_id",
                payload="Say this on the call",
                voice="female",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.Speak(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionSpeakParams{\n\t\t\tPayload: \"Say this on the call\",\n\t\t\tVoice:   \"female\",\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: |-
            package com.telnyx.sdk.example;

            import com.telnyx.sdk.client.TelnyxClient;
            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;
            import com.telnyx.sdk.models.calls.actions.ActionSpeakParams;
            import com.telnyx.sdk.models.calls.actions.ActionSpeakResponse;

            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionSpeakParams params = ActionSpeakParams.builder()
                        .callControlId("call_control_id")
                        .payload("Say this on the call")
                        .voice("female")
                        .build();
                    ActionSpeakResponse response = client.calls().actions().speak(params);
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response = telnyx.calls.actions.speak("call_control_id", payload:
            "Say this on the call", voice: "female")


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
              $response = $client->calls->actions->speak(
                'call_control_id',
                payload: 'Say this on the call',
                voice: 'female',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                language: 'arb',
                loop: 'string',
                payloadType: 'text',
                serviceLevel: 'basic',
                stop: 'current',
                targetLegs: 'both',
                voiceSettings: [
                  'type' => 'elevenlabs', 'apiKeyRef' => 'my_elevenlabs_api_key'
                ],
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions speak \
              --api-key 'My API Key' \
              --call-control-id call_control_id \
              --payload 'Say this on the call' \
              --voice female
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
    SpeakRequest:
      type: object
      title: Speak Request
      required:
        - payload
        - voice
      properties:
        payload:
          description: >-
            The text or SSML to be converted into speech. There is a 3,000
            character limit.
          type: string
          example: Say this on the call
        payload_type:
          description: >-
            The type of the provided payload. The payload can either be plain
            text, or Speech Synthesis Markup Language (SSML).
          default: text
          type: string
          enum:
            - text
            - ssml
          example: ssml
        service_level:
          description: >-
            This parameter impacts speech quality, language options and payload
            types. When using `basic`, only the `en-US` language and payload
            type `text` are allowed.
          default: premium
          type: string
          enum:
            - basic
            - premium
          example: premium
        stop:
          description: >-
            When specified, it stops the current audio being played. Specify
            `current` to stop the current audio being played, and to play the
            next file in the queue. Specify `all` to stop the current audio file
            being played and to also clear all audio files from the queue.
          type: string
          example: current
        voice:
          description: >-
            Specifies the voice used in speech synthesis.


            - Define voices using the format `<Provider>.<Model>.<VoiceId>`.
            Specifying only the provider will give default values for voice_id
            and model_id.

             **Supported Providers:**
            - **AWS:** Use `AWS.Polly.<VoiceId>` (e.g., `AWS.Polly.Joanna`). For
            neural voices, which provide more realistic, human-like speech,
            append `-Neural` to the `VoiceId` (e.g., `AWS.Polly.Joanna-Neural`).
            Check the [available
            voices](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html)
            for compatibility.

            - **Azure:** Use `Azure.<VoiceId>` (e.g., `Azure.en-CA-ClaraNeural`,
            `Azure.en-US-BrianMultilingualNeural`,
            `Azure.en-US-Ava:DragonHDLatestNeural`). For a complete list of
            voices, go to [Azure Voice
            Gallery](https://speech.microsoft.com/portal/voicegallery). Use
            `voice_settings` to configure custom deployments, regions, or API
            keys.

            - **ElevenLabs:** Use `ElevenLabs.<ModelId>.<VoiceId>` (e.g.,
            `ElevenLabs.eleven_multilingual_v2.21m00Tcm4TlvDq8ikWAM`). The
            `ModelId` part is optional. To use ElevenLabs, you must provide your
            ElevenLabs API key as an integration identifier secret in
            `"voice_settings": {"api_key_ref": "<secret_identifier>"}`. See
            [integration secrets
            documentation](https://developers.telnyx.com/api/secrets-manager/integration-secrets/create-integration-secret)
            for details. Check [available
            voices](https://elevenlabs.io/docs/api-reference/get-voices).

            - **Telnyx:** Use `Telnyx.<model_id>.<voice_id>` (e.g.,
            `Telnyx.KokoroTTS.af`). Use `voice_settings` to configure
            voice_speed and other synthesis parameters.

            - **Minimax:** Use `Minimax.<ModelId>.<VoiceId>` (e.g.,
            `Minimax.speech-02-hd.Wise_Woman`). Supported models:
            `speech-02-turbo`, `speech-02-hd`, `speech-2.6-turbo`,
            `speech-2.8-turbo`. Use `voice_settings` to configure speed, volume,
            pitch, and language_boost.

            - **Rime:** Use `Rime.<model_id>.<voice_id>` (e.g.,
            `Rime.Arcana.cove`). Supported model_ids: `Arcana`, `Mist`,
            `ArcanaV3`, `Coda`. Use `voice_settings` to configure voice_speed.

            - **Resemble:** Use `Resemble.Turbo.<voice_id>` (e.g.,
            `Resemble.Turbo.my_voice`). Only `Turbo` model is supported. Use
            `voice_settings` to configure precision, sample_rate, and format.

            - **Inworld:** Use `Inworld.<ModelId>.<VoiceId>` (e.g.,
            `Inworld.Mini.Loretta`, `Inworld.Max.Oliver`,
            `Inworld.TTS2.Loretta`). Supported models: `Mini`, `Max`, `TTS2`.
            Use `voice_settings` to configure `delivery_mode` (`STABLE`,
            `BALANCED`, `CREATIVE`), supported by `TTS2` only.

            - **xAI:** Use `xAI.<VoiceId>` (e.g., `xAI.eve`). Available voices:
            `eve`, `ara`, `rex`, `sal`, `leo`.


            For service_level basic, you may define the gender of the speaker
            (male or female).
          type: string
          example: Telnyx.KokoroTTS.af
        voice_settings:
          description: The settings associated with the voice selected
          oneOf:
            - $ref: '#/components/schemas/ElevenLabsVoiceSettings'
            - $ref: '#/components/schemas/TelnyxVoiceSettings'
            - $ref: '#/components/schemas/AWSVoiceSettings'
            - $ref: '#/components/schemas/MinimaxVoiceSettings'
            - $ref: '#/components/schemas/AzureVoiceSettings'
            - $ref: '#/components/schemas/RimeVoiceSettings'
            - $ref: '#/components/schemas/ResembleVoiceSettings'
            - $ref: '#/components/schemas/InworldVoiceSettings'
            - $ref: '#/components/schemas/XAIVoiceSettings'
          discriminator:
            propertyName: type
            mapping:
              elevenlabs:
                $ref: '#/components/schemas/ElevenLabsVoiceSettings'
              telnyx:
                $ref: '#/components/schemas/TelnyxVoiceSettings'
              aws:
                $ref: '#/components/schemas/AWSVoiceSettings'
              minimax:
                $ref: '#/components/schemas/MinimaxVoiceSettings'
              azure:
                $ref: '#/components/schemas/AzureVoiceSettings'
              rime:
                $ref: '#/components/schemas/RimeVoiceSettings'
              resemble:
                $ref: '#/components/schemas/ResembleVoiceSettings'
              inworld:
                $ref: '#/components/schemas/InworldVoiceSettings'
              xai:
                $ref: '#/components/schemas/XAIVoiceSettings'
        language:
          description: >-
            The language you want spoken. This parameter is ignored when a
            `Polly.*` voice is specified.
          type: string
          enum:
            - arb
            - cmn-CN
            - cy-GB
            - da-DK
            - de-DE
            - en-AU
            - en-GB
            - en-GB-WLS
            - en-IN
            - en-US
            - es-ES
            - es-MX
            - es-US
            - fr-CA
            - fr-FR
            - hi-IN
            - is-IS
            - it-IT
            - ja-JP
            - ko-KR
            - nb-NO
            - nl-NL
            - pl-PL
            - pt-BR
            - pt-PT
            - ro-RO
            - ru-RU
            - sv-SE
            - tr-TR
          example: en-US
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
        loop:
          $ref: '#/components/schemas/Loopcount'
          description: >-
            The number of times to play the audio file. Use `infinity` to loop
            indefinitely. Defaults to 1.
        target_legs:
          description: Specifies which legs of the call should receive the spoken audio.
          type: string
          enum:
            - self
            - opposite
            - both
          default: self
          example: both
      example:
        payload: Say this on the call
        payload_type: text
        service_level: basic
        stop: current
        voice: female
        language: arb
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
    ElevenLabsVoiceSettings:
      type: object
      title: ElevenLabs Voice Settings
      properties:
        type:
          type: string
          enum:
            - elevenlabs
          description: Voice settings provider type
        api_key_ref:
          description: >-
            The `identifier` for an integration secret
            [/v2/integration_secrets](https://developers.telnyx.com/api/secrets-manager/integration-secrets/create-integration-secret)
            that refers to your ElevenLabs API key. Warning: Free plans are
            unlikely to work with this integration.
          type: string
          example: my_elevenlabs_api_key
      required:
        - type
    TelnyxVoiceSettings:
      type: object
      title: Telnyx Voice Settings
      properties:
        type:
          type: string
          enum:
            - telnyx
          description: Voice settings provider type
        voice_speed:
          description: >-
            The voice speed to be used for the voice. The voice speed must be
            between 0.1 and 2.0. Default value is 1.0.
          type: number
          default: 1
          format: float
          example: 1
          minimum: 0.1
          maximum: 2
      required:
        - type
    AWSVoiceSettings:
      type: object
      title: AWS Voice Settings
      properties:
        type:
          type: string
          enum:
            - aws
          description: Voice settings provider type
      required:
        - type
    MinimaxVoiceSettings:
      type: object
      title: Minimax Voice Settings
      properties:
        type:
          type: string
          enum:
            - minimax
          description: Voice settings provider type
        speed:
          description: Speech speed multiplier. Default is 1.0.
          type: number
          format: float
          example: 1
          default: 1
        vol:
          description: Speech volume multiplier. Default is 1.0.
          type: number
          format: float
          example: 1
          default: 1
        pitch:
          description: Voice pitch adjustment. Default is 0.
          type: integer
          example: 0
          default: 0
        language_boost:
          type:
            - string
            - 'null'
          description: >-
            Enhances recognition for specific languages and dialects during
            MiniMax TTS synthesis. Default is null (no boost). Set to 'auto' for
            automatic language detection.
          enum:
            - null
            - auto
            - Chinese
            - Chinese,Yue
            - English
            - Arabic
            - Russian
            - Spanish
            - French
            - Portuguese
            - German
            - Turkish
            - Dutch
            - Ukrainian
            - Vietnamese
            - Indonesian
            - Japanese
            - Italian
            - Korean
            - Thai
            - Polish
            - Romanian
            - Greek
            - Czech
            - Finnish
            - Hindi
            - Bulgarian
            - Danish
            - Hebrew
            - Malay
            - Persian
            - Slovak
            - Swedish
            - Croatian
            - Filipino
            - Hungarian
            - Norwegian
            - Slovenian
            - Catalan
            - Nynorsk
            - Tamil
            - Afrikaans
          default: null
      required:
        - type
    AzureVoiceSettings:
      type: object
      title: Azure Voice Settings
      properties:
        type:
          type: string
          enum:
            - azure
          description: Voice settings provider type
        api_key_ref:
          description: >-
            The `identifier` for an integration secret that refers to your Azure
            Speech API key.
          type: string
          example: my_azure_api_key
        region:
          description: >-
            The Azure region for the Speech service (e.g., `eastus`,
            `westeurope`). Required when using a custom API key.
          type: string
          example: eastus
        deployment_id:
          description: The deployment ID for a custom Azure neural voice.
          type: string
          example: my-custom-voice-deployment
        effect:
          description: Audio effect to apply.
          type: string
          enum:
            - eq_car
            - eq_telecomhp8k
        gender:
          description: Voice gender filter.
          type: string
          enum:
            - Male
            - Female
      required:
        - type
    RimeVoiceSettings:
      type: object
      title: Rime Voice Settings
      properties:
        type:
          type: string
          enum:
            - rime
          description: Voice settings provider type
        voice_speed:
          description: Speech speed multiplier. Default is 1.0.
          type: number
          format: float
          example: 1
          default: 1
      required:
        - type
    ResembleVoiceSettings:
      type: object
      title: Resemble Voice Settings
      properties:
        type:
          type: string
          enum:
            - resemble
          description: Voice settings provider type
        precision:
          description: Audio precision format.
          type: string
          enum:
            - PCM_16
            - PCM_24
            - PCM_32
            - MULAW
          default: PCM_32
        sample_rate:
          $ref: '#/components/schemas/ResembleSampleRate'
        format:
          description: Output audio format.
          type: string
          enum:
            - wav
            - mp3
          default: mp3
      required:
        - type
    InworldVoiceSettings:
      type: object
      title: Inworld Voice Settings
      properties:
        type:
          type: string
          enum:
            - inworld
          description: Voice settings provider type
        delivery_mode:
          type: string
          enum:
            - STABLE
            - BALANCED
            - CREATIVE
          description: >-
            Controls the expressiveness and consistency of the Inworld `TTS2`
            model's speech synthesis. `STABLE` favors consistent, predictable
            output, `CREATIVE` allows more expressive variation, and `BALANCED`
            sits in between. Optional and only supported by `TTS2`; when
            omitted, the provider default applies.
      required:
        - type
    XAIVoiceSettings:
      type: object
      title: xAI Voice Settings
      properties:
        type:
          type: string
          enum:
            - xai
          description: Voice settings provider type
        language:
          description: Language code, or `auto` to detect automatically.
          type: string
          default: auto
      required:
        - type
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
    ResembleSampleRate:
      type: string
      title: Resemble Sample Rate
      description: Audio sample rate in Hz.
      enum:
        - '8000'
        - '16000'
        - '22050'
        - '32000'
        - '44100'
        - '48000'
      default: '48000'
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
