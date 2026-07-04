---
title: "Gather using AI"
source_url: "https://developers.telnyx.com/api-reference/call-commands/gather-using-ai.md"
category: "call-control"
synced_at: "2026-06-25T18:43:10.832Z"
content_hash: "b6d74092e8b4d14a866b0af56eb37dc7d0c13e628db38340ebdd37601f190e90"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Gather using AI

> Gather parameters defined in the request payload using a voice assistant.

 You can pass parameters described as a JSON Schema object and the voice assistant will attempt to gather these informations. 

**Expected Webhooks:**

- `call.ai_gather.ended`
- `call.conversation.ended`
- `call.ai_gather.partial_results` (if `send_partial_results` is set to `true`)
- `call.ai_gather.message_history_updated` (if `send_message_history_updates` is set to `true`)




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/gather-using-ai.yml post /calls/{call_control_id}/actions/gather_using_ai
openapi: 3.1.0
info:
  title: Telnyx Call Control - Gather Using AI
  version: 2.0.0
  description: API for gathering input using AI.
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
  /calls/{call_control_id}/actions/gather_using_ai:
    post:
      tags:
        - Call Commands
      summary: Gather using AI
      description: >
        Gather parameters defined in the request payload using a voice
        assistant.

         You can pass parameters described as a JSON Schema object and the voice assistant will attempt to gather these informations. 

        **Expected Webhooks:**


        - `call.ai_gather.ended`

        - `call.conversation.ended`

        - `call.ai_gather.partial_results` (if `send_partial_results` is set to
        `true`)

        - `call.ai_gather.message_history_updated` (if
        `send_message_history_updates` is set to `true`)
      operationId: callGatherUsingAI
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Gather using AI request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GatherUsingAIRequest'
      responses:
        '200':
          description: >-
            Successful response upon making a call control command that includes
            conversation_id.
          content:
            application/json:
              schema:
                type: object
                title: Call Control Command Response With Conversation ID
                properties:
                  data:
                    $ref: >-
                      #/components/schemas/CallControlCommandResultWithConversationId
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
            client.calls.actions.gatherUsingAI('call_control_id', {
              parameters: {
                properties: 'bar',
                required: 'bar',
                type: 'bar',
              },
            });


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.gather_using_ai(
                call_control_id="call_control_id",
                parameters={
                    "properties": "bar",
                    "required": "bar",
                    "type": "bar",
                },
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.GatherUsingAI(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionGatherUsingAIParams{\n\t\t\tParameters: map[string]any{\n\t\t\t\t\"properties\": \"bar\",\n\t\t\t\t\"required\":   \"bar\",\n\t\t\t\t\"type\":       \"bar\",\n\t\t\t},\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import com.telnyx.sdk.core.JsonValue;

            import
            com.telnyx.sdk.models.calls.actions.ActionGatherUsingAiParams;

            import
            com.telnyx.sdk.models.calls.actions.ActionGatherUsingAiResponse;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionGatherUsingAiParams params = ActionGatherUsingAiParams.builder()
                        .callControlId("call_control_id")
                        .parameters(ActionGatherUsingAiParams.Parameters.builder()
                            .putAdditionalProperty("properties", JsonValue.from("bar"))
                            .putAdditionalProperty("required", JsonValue.from("bar"))
                            .putAdditionalProperty("type", JsonValue.from("bar"))
                            .build())
                        .build();
                    ActionGatherUsingAiResponse response = client.calls().actions().gatherUsingAi(params);
                }
            }
        - lang: Ruby
          source: |-
            require "telnyx"

            telnyx = Telnyx::Client.new(api_key: "My API Key")

            response = telnyx.calls.actions.gather_using_ai(
              "call_control_id",
              parameters: {properties: "bar", required: "bar", type: "bar"}
            )

            puts(response)
        - lang: PHP
          source: >-
            <?php


            require_once dirname(__DIR__) . '/vendor/autoload.php';


            use Telnyx\Client;

            use Telnyx\Calls\Actions\GoogleTranscriptionLanguage;

            use Telnyx\Core\Exceptions\APIException;


            $client = new Client(apiKey: getenv('TELNYX_API_KEY') ?: 'My API
            Key');


            try {
              $response = $client->calls->actions->gatherUsingAI(
                'call_control_id',
                parameters: ['properties' => 'bar', 'required' => 'bar', 'type' => 'bar'],
                assistant: [
                  'instructions' => 'You are a friendly voice assistant.',
                  'model' => 'Qwen/Qwen3-235B-A22B',
                  'openaiAPIKeyRef' => 'my_openai_api_key',
                  'tools' => [
                    [
                      'bookAppointment' => [
                        'apiKeyRef' => 'my_calcom_api_key',
                        'eventTypeID' => 0,
                        'attendeeName' => 'attendee_name',
                        'attendeeTimezone' => 'attendee_timezone',
                      ],
                      'type' => 'book_appointment',
                    ],
                  ],
                ],
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                gatherEndedSpeech: 'Thank you for providing the information.',
                greeting: 'Hello, can you tell me your age and where you live?',
                interruptionSettings: ['enable' => true],
                language: GoogleTranscriptionLanguage::EN,
                messageHistory: [
                  ['content' => 'Hello, what\'s your name?', 'role' => 'assistant'],
                  ['content' => 'Hello, I\'m John.', 'role' => 'user'],
                ],
                sendMessageHistoryUpdates: true,
                sendPartialResults: true,
                transcription: [
                  'language' => 'auto', 'model' => 'distil-whisper/distil-large-v2'
                ],
                userResponseTimeoutMs: 5000,
                voice: 'Telnyx.KokoroTTS.af',
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
            telnyx calls:actions gather-using-ai \
              --api-key 'My API Key' \
              --call-control-id call_control_id \
              --parameters '{properties: bar, required: bar, type: bar}'
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
    GatherUsingAIRequest:
      type: object
      title: Gather Using AI Request
      required:
        - parameters
      properties:
        parameters:
          description: >-
            The parameters described as a JSON Schema object that needs to be
            gathered by the voice assistant. See the [JSON Schema
            reference](https://json-schema.org/understanding-json-schema) for
            documentation about the format
          type: object
          example:
            properties:
              age:
                description: The age of the customer.
                type: integer
              location:
                description: The location of the customer.
                type: string
            required:
              - age
              - location
            type: object
        assistant:
          $ref: '#/components/schemas/Assistant'
        transcription:
          $ref: '#/components/schemas/TranscriptionConfig'
        language:
          oneOf:
            - $ref: '#/components/schemas/GoogleTranscriptionLanguage'
        voice:
          $ref: '#/components/schemas/VoiceConfig'
        voice_settings:
          description: The settings associated with the voice selected
          oneOf:
            - $ref: '#/components/schemas/ElevenLabsVoiceSettings'
            - $ref: '#/components/schemas/TelnyxVoiceSettings'
            - $ref: '#/components/schemas/AWSVoiceSettings'
            - $ref: '#/components/schemas/AzureVoiceSettings'
            - $ref: '#/components/schemas/RimeVoiceSettings'
            - $ref: '#/components/schemas/ResembleVoiceSettings'
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
              azure:
                $ref: '#/components/schemas/AzureVoiceSettings'
              rime:
                $ref: '#/components/schemas/RimeVoiceSettings'
              resemble:
                $ref: '#/components/schemas/ResembleVoiceSettings'
              xai:
                $ref: '#/components/schemas/XAIVoiceSettings'
        greeting:
          description: >-
            Text that will be played when the gathering starts, if none then
            nothing will be played when the gathering starts. The greeting can
            be text for any voice or SSML for `AWS.Polly.<voice_id>` voices.
            There is a 3,000 character limit.
          type: string
          example: Hello, can you tell me your age and where you live?
        send_partial_results:
          description: >-
            Default is `false`. If set to `true`, the voice assistant will send
            partial results via the `call.ai_gather.partial_results` callback in
            real time as individual fields are gathered. If set to `false`, the
            voice assistant will only send the final result via the
            `call.ai_gather.ended` callback.
          type: boolean
          example: false
        send_message_history_updates:
          description: >-
            Default is `false`. If set to `true`, the voice assistant will send
            updates to the message history via the
            `call.ai_gather.message_history_updated` callback in real time as
            the message history is updated.
          type: boolean
          example: false
        message_history:
          description: >-
            The message history you want the voice assistant to be aware of,
            this can be useful to keep the context of the conversation, or to
            pass additional information to the voice assistant.
          type: array
          items:
            type: object
            properties:
              content:
                type: string
                example: Hello, I'm 29 and I live in Paris.
                description: The content of the message
              role:
                type: string
                enum:
                  - assistant
                  - user
                example: user
                description: The role of the message sender
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
        interruption_settings:
          $ref: '#/components/schemas/InterruptionSettings'
        user_response_timeout_ms:
          description: >-
            The maximum time in milliseconds to wait for user response before
            timing out.
          type: integer
          default: 10000
          example: 15000
        gather_ended_speech:
          description: >-
            Text that will be played when the gathering has finished. There is a
            3,000 character limit.
          type: string
          maxLength: 3000
          example: Thank you for providing the information.
      example:
        parameters:
          properties:
            age:
              description: The age of the customer.
              type: integer
            location:
              description: The location of the customer.
              type: string
          required:
            - age
            - location
          type: object
        voice: Telnyx.KokoroTTS.af
        greeting: Hello, can you tell me your age and where you live?
        send_partial_results: true
        send_message_history_updates: true
        message_history:
          - content: Hello, what's your name?
            role: assistant
          - content: Hello, I'm John.
            role: user
        client_state: aGF2ZSBhIG5pY2UgZGF5ID1d
        command_id: 891510ac-f3e4-11e8-af5b-de00688a4901
        user_response_timeout_ms: 5000
    CallControlCommandResultWithConversationId:
      type: object
      title: Call Control Command Result With Conversation ID
      example:
        result: ok
        conversation_id: d7e9c1d4-8b2a-4b8f-b3a7-9a671c9e9b0a
      properties:
        result:
          type: string
          example: ok
        conversation_id:
          type: string
          format: uuid
          example: d7e9c1d4-8b2a-4b8f-b3a7-9a671c9e9b0a
          description: The ID of the conversation created by the command.
    Assistant:
      type: object
      title: Assistant
      description: >-
        Assistant configuration including choice of LLM, custom instructions,
        and tools.
      properties:
        model:
          description: The model to be used by the voice assistant.
          type: string
          default: Qwen/Qwen3-235B-A22B
          example: Qwen/Qwen3-235B-A22B
        instructions:
          description: >-
            The system instructions that the voice assistant uses during the
            gather command
          type: string
          example: You are a friendly voice assistant.
        openai_api_key_ref:
          description: >-
            This is necessary only if the model selected is from OpenAI. You
            would pass the `identifier` for an integration secret
            [/v2/integration_secrets](https://developers.telnyx.com/api/secrets-manager/integration-secrets/create-integration-secret)
            that refers to your OpenAI API Key. Warning: Free plans are unlikely
            to work with this integration.
          type: string
          example: my_openai_api_key
        tools:
          description: The tools that the voice assistant can use.
          type: array
          items:
            oneOf:
              - $ref: '#/components/schemas/BookAppointmentTool'
              - $ref: '#/components/schemas/CheckAvailabilityTool'
              - $ref: '#/components/schemas/WebhookTool'
              - $ref: '#/components/schemas/HangupTool'
              - $ref: '#/components/schemas/TransferTool'
              - $ref: '#/components/schemas/CallControlRetrievalTool'
            discriminator:
              propertyName: type
              mapping:
                book_appointment:
                  $ref: '#/components/schemas/BookAppointmentTool'
                check_availability:
                  $ref: '#/components/schemas/CheckAvailabilityTool'
                webhook:
                  $ref: '#/components/schemas/WebhookTool'
                hangup:
                  $ref: '#/components/schemas/HangupTool'
                transfer:
                  $ref: '#/components/schemas/TransferTool'
                retrieval:
                  $ref: '#/components/schemas/CallControlRetrievalTool'
    TranscriptionConfig:
      type: object
      description: >-
        The settings associated with speech to text for the voice assistant.
        This is only relevant if the assistant uses a text-to-text language
        model. Any assistant using a model with native audio support (e.g.
        `fixie-ai/ultravox-v0_4`) will ignore this field.
      properties:
        model:
          description: >-
            The speech to text model to be used by the voice assistant.
            Supported models include:


            - `deepgram/flux` (or `flux`) for live streaming turn-taking.

            - `deepgram/nova-3` and `deepgram/nova-2` for live streaming
            transcription.

            - `speechmatics/standard` and `speechmatics/enhanced` for live
            streaming transcription.

            - `assemblyai/universal-streaming` for live streaming transcription.

            - `xai/grok-stt` for live streaming transcription.

            - `soniox/stt-rt-v4` for live streaming multilingual transcription
            with automatic language detection.

            - `azure/fast` and `azure/realtime`; Azure models require `region`,
            and unsupported regions require `api_key_ref`.

            - `google/latest_long` for non-streaming multilingual transcription.

            - `distil-whisper/distil-large-v2` for lower-latency English-only
            non-streaming transcription.

            - `openai/whisper-large-v3-turbo` for multilingual non-streaming
            transcription with automatic language detection.
          type: string
          enum:
            - deepgram/flux
            - flux
            - deepgram/nova-3
            - deepgram/nova-2
            - speechmatics/standard
            - speechmatics/enhanced
            - assemblyai/universal-streaming
            - xai/grok-stt
            - soniox/stt-rt-v4
            - azure/fast
            - azure/realtime
            - google/latest_long
            - distil-whisper/distil-large-v2
            - openai/whisper-large-v3-turbo
          default: distil-whisper/distil-large-v2
          example: distil-whisper/distil-large-v2
        language:
          type: string
          description: >-
            The language of the audio to be transcribed. If not set, or if set
            to `auto`, supported models will automatically detect the language.
            Supported and meaningful values depend on the selected transcription
            `model`. For `deepgram/flux`, supported values are: `auto` (Telnyx
            language detection controls the language hint), `multi` (no language
            hint), and language-specific hints `en`, `es`, `fr`, `de`, `hi`,
            `ru`, `pt`, `ja`, `it`, and `nl`. For `soniox/stt-rt-v4`, `auto`
            omits the language hint and lets Soniox auto-detect; ISO 639-1 codes
            (e.g. `en`, `es`) bias detection toward that language.
          default: auto
          example: auto
    GoogleTranscriptionLanguage:
      title: Google transcription engine list of languages
      type: string
      description: Language to use for speech recognition
      example: en
      default: en
      enum:
        - af
        - sq
        - am
        - ar
        - hy
        - az
        - eu
        - bn
        - bs
        - bg
        - my
        - ca
        - yue
        - zh
        - hr
        - cs
        - da
        - nl
        - en
        - et
        - fil
        - fi
        - fr
        - gl
        - ka
        - de
        - el
        - gu
        - iw
        - hi
        - hu
        - is
        - id
        - it
        - ja
        - jv
        - kn
        - kk
        - km
        - ko
        - lo
        - lv
        - lt
        - mk
        - ms
        - ml
        - mr
        - mn
        - ne
        - 'no'
        - fa
        - pl
        - pt
        - pa
        - ro
        - ru
        - rw
        - sr
        - si
        - sk
        - sl
        - ss
        - st
        - es
        - su
        - sw
        - sv
        - ta
        - te
        - th
        - tn
        - tr
        - ts
        - uk
        - ur
        - uz
        - ve
        - vi
        - xh
        - zu
    VoiceConfig:
      description: >-
        The voice to be used by the voice assistant. Currently we support
        ElevenLabs, Telnyx and AWS voices.

         **Supported Providers:**
        - **AWS:** Use `AWS.Polly.<VoiceId>` (e.g., `AWS.Polly.Joanna`). For
        neural voices, which provide more realistic, human-like speech, append
        `-Neural` to the `VoiceId` (e.g., `AWS.Polly.Joanna-Neural`). Check the
        [available
        voices](https://docs.aws.amazon.com/polly/latest/dg/available-voices.html)
        for compatibility.

        - **Azure:** Use `Azure.<VoiceId>. (e.g. Azure.en-CA-ClaraNeural,
        Azure.en-CA-LiamNeural, Azure.en-US-BrianMultilingualNeural,
        Azure.en-US-Ava:DragonHDLatestNeural. For a complete list of voices, go
        to [Azure Voice
        Gallery](https://speech.microsoft.com/portal/voicegallery).)

        - **ElevenLabs:** Use `ElevenLabs.<ModelId>.<VoiceId>` (e.g.,
        `ElevenLabs.BaseModel.John`). The `ModelId` part is optional. To use
        ElevenLabs, you must provide your ElevenLabs API key as an integration
        secret under `"voice_settings": {"api_key_ref": "<secret_id>"}`. See
        [integration secrets
        documentation](https://developers.telnyx.com/api/secrets-manager/integration-secrets/create-integration-secret)
        for details. Check [available
        voices](https://elevenlabs.io/docs/api-reference/get-voices).
         - **Telnyx:** Use `Telnyx.<model_id>.<voice_id>`
        - **Inworld:** Use `Inworld.<ModelId>.<VoiceId>` (e.g.,
        `Inworld.Mini.Loretta`, `Inworld.Max.Oliver`, `Inworld.TTS2.Loretta`).
        Supported models: `Mini`, `Max`, `TTS2`.

        - **xAI:** Use `xAI.<VoiceId>` (e.g., `xAI.eve`). Available voices:
        `eve`, `ara`, `rex`, `sal`, `leo`.
      type: string
      default: Telnyx.KokoroTTS.af
      example: Telnyx.KokoroTTS.af
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
          default: 1
          example: 1
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
    InterruptionSettings:
      type: object
      description: Settings for handling user interruptions during assistant speech
      properties:
        enable:
          type: boolean
          description: When true, allows users to interrupt the assistant while speaking
          default: true
    call-control_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/call-control_Error'
    BookAppointmentTool:
      properties:
        type:
          type: string
          enum:
            - book_appointment
        book_appointment:
          $ref: '#/components/schemas/BookAppointmentToolParams'
      type: object
      required:
        - type
        - book_appointment
      title: BookAppointmentTool
    CheckAvailabilityTool:
      properties:
        type:
          type: string
          enum:
            - check_availability
        check_availability:
          $ref: '#/components/schemas/CheckAvailabilityToolParams'
      type: object
      required:
        - type
        - check_availability
      title: CheckAvailabilityTool
    WebhookTool:
      properties:
        type:
          type: string
          enum:
            - webhook
        webhook:
          $ref: '#/components/schemas/CallControlWebhookToolParams'
      type: object
      required:
        - type
        - webhook
      title: WebhookTool
    HangupTool:
      properties:
        type:
          type: string
          enum:
            - hangup
        hangup:
          $ref: '#/components/schemas/HangupToolParams'
      type: object
      required:
        - type
        - hangup
      title: HangupTool
    TransferTool:
      properties:
        type:
          type: string
          enum:
            - transfer
        transfer:
          $ref: '#/components/schemas/CallControlTransferToolParams'
      type: object
      required:
        - type
        - transfer
      title: TransferTool
    CallControlRetrievalTool:
      properties:
        type:
          type: string
          enum:
            - retrieval
        retrieval:
          $ref: '#/components/schemas/CallControlBucketIds'
      type: object
      required:
        - type
        - retrieval
      title: RetrievalTool
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
    BookAppointmentToolParams:
      properties:
        event_type_id:
          type: integer
          description: >-
            Event Type ID for which slots are being fetched.
            [cal.com](https://cal.com/docs/api-reference/v2/bookings/create-a-booking#body-event-type-id)
        api_key_ref:
          type: string
          description: >-
            Reference to an integration secret that contains your Cal.com API
            key. You would pass the `identifier` for an integration secret
            [/v2/integration_secrets](https://developers.telnyx.com/api/secrets-manager/integration-secrets/create-integration-secret)
            that refers to your Cal.com API key.
          example: my_calcom_api_key
        attendee_name:
          type: string
          description: >-
            The name of the attendee
            [cal.com](https://cal.com/docs/api-reference/v2/bookings/create-a-booking#body-attendee-name).
            If not provided, the assistant will ask for the attendee's name.
        attendee_timezone:
          type: string
          description: >-
            The timezone of the attendee
            [cal.com](https://cal.com/docs/api-reference/v2/bookings/create-a-booking#body-attendee-timezone).
            If not provided, the assistant will ask for the attendee's timezone.
      type: object
      required:
        - event_type_id
        - api_key_ref
      title: BookAppointmentToolParams
    CheckAvailabilityToolParams:
      properties:
        event_type_id:
          type: integer
          description: >-
            Event Type ID for which slots are being fetched.
            [cal.com](https://cal.com/docs/api-reference/v2/slots/get-available-slots#parameter-event-type-id)
        api_key_ref:
          type: string
          description: >-
            Reference to an integration secret that contains your Cal.com API
            key. You would pass the `identifier` for an integration secret
            [/v2/integration_secrets](https://developers.telnyx.com/api/secrets-manager/integration-secrets/create-integration-secret)
            that refers to your Cal.com API key.
          example: my_calcom_api_key
      type: object
      required:
        - event_type_id
        - api_key_ref
      title: CheckAvailabilityToolParams
    CallControlWebhookToolParams:
      properties:
        name:
          type: string
          description: The name of the tool.
        description:
          type: string
          description: The description of the tool.
        url:
          description: >-
            The URL of the external tool to be called. This URL is going to be
            used by the assistant. The URL can be templated like:
            `https://example.com/api/v1/{id}`, where `{id}` is a placeholder for
            a value that will be provided by the assistant if `path_parameters`
            are provided with the `id` attribute.
          type: string
          example: https://example.com/api/v1/function
        method:
          description: The HTTP method to be used when calling the external tool.
          type: string
          enum:
            - GET
            - POST
            - PUT
            - DELETE
            - PATCH
          default: POST
        headers:
          description: The headers to be sent to the external tool.
          type: array
          items:
            type: object
            properties:
              name:
                type: string
              value:
                description: >-
                  The value of the header. Note that we support mustache
                  templating for the value. For example you can use `Bearer
                  {{#integration_secret}}test-secret{{/integration_secret}}` to
                  pass the value of the integration secret as the bearer token.
                type: string
        body_parameters:
          description: >-
            The body parameters the webhook tool accepts, described as a JSON
            Schema object. These parameters will be passed to the webhook as the
            body of the request. See the [JSON Schema
            reference](https://json-schema.org/understanding-json-schema) for
            documentation about the format
          type: object
          properties:
            properties:
              description: The properties of the body parameters.
              type: object
            required:
              description: The required properties of the body parameters.
              type: array
              items:
                type: string
            type:
              type: string
              enum:
                - object
          example:
            properties:
              age:
                description: The age of the customer.
                type: integer
              location:
                description: The location of the customer.
                type: string
            required:
              - age
              - location
            type: object
        path_parameters:
          description: >-
            The path parameters the webhook tool accepts, described as a JSON
            Schema object. These parameters will be passed to the webhook as the
            path of the request if the URL contains a placeholder for a value.
            See the [JSON Schema
            reference](https://json-schema.org/understanding-json-schema) for
            documentation about the format
          type: object
          properties:
            properties:
              description: The properties of the path parameters.
              type: object
            required:
              description: The required properties of the path parameters.
              type: array
              items:
                type: string
            type:
              type: string
              enum:
                - object
          example:
            properties:
              id:
                description: The id of the customer.
                type: string
            required:
              - id
            type: object
        query_parameters:
          description: >-
            The query parameters the webhook tool accepts, described as a JSON
            Schema object. These parameters will be passed to the webhook as the
            query of the request. See the [JSON Schema
            reference](https://json-schema.org/understanding-json-schema) for
            documentation about the format
          type: object
          properties:
            properties:
              description: The properties of the query parameters.
              type: object
            required:
              description: The required properties of the query parameters.
              type: array
              items:
                type: string
            type:
              type: string
              enum:
                - object
          example:
            properties:
              page:
                description: The page number.
                type: integer
            required:
              - page
            type: object
      type: object
      required:
        - url
        - name
        - description
      title: WebhookToolParams
    HangupToolParams:
      properties:
        description:
          type: string
          default: This tool is used to hang up the call.
          description: >-
            The description of the function that will be passed to the
            assistant.
      type: object
      title: HangupToolParams
    CallControlTransferToolParams:
      properties:
        targets:
          oneOf:
            - type: array
              items:
                type: object
                properties:
                  name:
                    type: string
                    description: The name of the target.
                    example: Support
                  to:
                    type: string
                    description: The destination number or SIP URI of the call.
                    example: '+13129457420'
                required:
                  - to
            - type: string
              description: >-
                A dynamic variable string like `{{ targets }}` where `targets`
                is returned by the dynamic variables webhook and resolves to an
                array of target objects at runtime.
              example: '{{ targets }}'
          description: >-
            The different possible targets of the transfer. The assistant will
            be able to choose one of the targets to transfer the call to. This
            can also be a dynamic variable string like `{{ targets }}` where
            `targets` is returned by the dynamic variables webhook and resolves
            to an array of target objects at runtime.
        from:
          type: string
          example: '+35319605860'
          description: Number or SIP URI placing the call.
      type: object
      required:
        - targets
        - from
      title: TransferToolParams
    CallControlBucketIds:
      properties:
        bucket_ids:
          items:
            type: string
          type: array
          title: Bucket Ids
        max_num_results:
          description: >-
            The maximum number of results to retrieve as context for the
            language model.
          type: integer
      type: object
      required:
        - bucket_ids
      title: BucketIds
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
