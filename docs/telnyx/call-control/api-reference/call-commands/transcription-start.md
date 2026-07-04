---
title: "Transcription start"
source_url: "https://developers.telnyx.com/api-reference/call-commands/transcription-start.md"
category: "call-control"
synced_at: "2026-06-25T18:43:15.749Z"
content_hash: "dd38a10dad856d9a8f5c3b8535836a1c2dbcab84d2a427bdb0ae2ed74f0955c4"
---
> ## Documentation Index
> Fetch the complete documentation index at: https://developers.telnyx.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Transcription start

> Start real-time transcription. Transcription will stop on call hang-up, or can be initiated via the Transcription stop command.

**Expected Webhooks:**

- `call.transcription`




## OpenAPI

````yaml https://telnyx-openapi-ng.s3.us-east-1.amazonaws.com/call-control-commands/transcription-start.yml post /calls/{call_control_id}/actions/transcription_start
openapi: 3.1.0
info:
  title: Telnyx Call Control - Transcription Start
  version: 2.0.0
  description: API for starting call transcription.
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
  /calls/{call_control_id}/actions/transcription_start:
    post:
      tags:
        - Call Commands
      summary: Transcription start
      description: >
        Start real-time transcription. Transcription will stop on call hang-up,
        or can be initiated via the Transcription stop command.


        **Expected Webhooks:**


        - `call.transcription`
      operationId: StartCallTranscription
      parameters:
        - $ref: '#/components/parameters/CallControlId'
      requestBody:
        description: Transcription start request
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TranscriptionStartRequest'
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
            client.calls.actions.startTranscription('call_control_id');


            console.log(response.data);
        - lang: Python
          source: |-
            import os
            from telnyx import Telnyx

            client = Telnyx(
                api_key=os.environ.get("TELNYX_API_KEY"),  # This is the default and can be omitted
            )
            response = client.calls.actions.start_transcription(
                call_control_id="call_control_id",
            )
            print(response.data)
        - lang: Go
          source: "package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\n\t\"github.com/team-telnyx/telnyx-go\"\n\t\"github.com/team-telnyx/telnyx-go/option\"\n)\n\nfunc main() {\n\tclient := telnyx.NewClient(\n\t\toption.WithAPIKey(\"My API Key\"),\n\t)\n\tresponse, err := client.Calls.Actions.StartTranscription(\n\t\tcontext.TODO(),\n\t\t\"call_control_id\",\n\t\ttelnyx.CallActionStartTranscriptionParams{\n\t\t\tTranscriptionStartRequest: telnyx.TranscriptionStartRequestParam{},\n\t\t},\n\t)\n\tif err != nil {\n\t\tpanic(err.Error())\n\t}\n\tfmt.Printf(\"%+v\\n\", response.Data)\n}\n"
        - lang: Java
          source: >-
            package com.telnyx.sdk.example;


            import com.telnyx.sdk.client.TelnyxClient;

            import com.telnyx.sdk.client.okhttp.TelnyxOkHttpClient;

            import
            com.telnyx.sdk.models.calls.actions.ActionStartTranscriptionParams;

            import
            com.telnyx.sdk.models.calls.actions.ActionStartTranscriptionResponse;

            import
            com.telnyx.sdk.models.calls.actions.TranscriptionStartRequest;


            public final class Main {
                private Main() {}

                public static void main(String[] args) {
                    TelnyxClient client = TelnyxOkHttpClient.fromEnv();

                    ActionStartTranscriptionParams params = ActionStartTranscriptionParams.builder()
                        .callControlId("call_control_id")
                        .transcriptionStartRequest(TranscriptionStartRequest.builder().build())
                        .build();
                    ActionStartTranscriptionResponse response = client.calls().actions().startTranscription(params);
                }
            }
        - lang: Ruby
          source: >-
            require "telnyx"


            telnyx = Telnyx::Client.new(api_key: "My API Key")


            response =
            telnyx.calls.actions.start_transcription("call_control_id")


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
              $response = $client->calls->actions->startTranscription(
                'call_control_id',
                clientState: 'aGF2ZSBhIG5pY2UgZGF5ID1d',
                commandID: '891510ac-f3e4-11e8-af5b-de00688a4901',
                transcriptionEngine: 'Google',
                transcriptionEngineConfig: [
                  'enableSpeakerDiarization' => true,
                  'hints' => ['string'],
                  'interimResults' => true,
                  'language' => GoogleTranscriptionLanguage::EN,
                  'maxSpeakerCount' => 4,
                  'minSpeakerCount' => 4,
                  'model' => 'latest_long',
                  'profanityFilter' => true,
                  'speechContext' => [['boost' => 1, 'phrases' => ['string']]],
                  'transcriptionEngine' => 'Google',
                  'useEnhanced' => true,
                ],
                transcriptionTracks: 'both',
              );

              var_dump($response);
            } catch (APIException $e) {
              echo $e->getMessage();
            }
        - lang: CLI
          source: |-
            telnyx calls:actions start-transcription \
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
    TranscriptionStartRequest:
      type: object
      title: Transcription start request
      properties:
        transcription_engine:
          description: >-
            Engine to use for speech recognition. Legacy values `A` - `Google`,
            `B` - `Telnyx` are supported for backward compatibility.
          type: string
          enum:
            - Google
            - Telnyx
            - Deepgram
            - Azure
            - xAI
            - AssemblyAI
            - Speechmatics
            - Soniox
            - Parakeet
            - A
            - B
          default: Google
          example: Google
        transcription_engine_config:
          oneOf:
            - $ref: '#/components/schemas/TranscriptionEngineGoogleConfig'
            - $ref: '#/components/schemas/TranscriptionEngineTelnyxConfig'
            - $ref: '#/components/schemas/TranscriptionEngineDeepgramConfig'
            - $ref: '#/components/schemas/TranscriptionEngineAzureConfig'
            - $ref: '#/components/schemas/TranscriptionEngineXaiConfig'
            - $ref: '#/components/schemas/TranscriptionEngineAssemblyaiConfig'
            - $ref: '#/components/schemas/TranscriptionEngineSpeechmaticsConfig'
            - $ref: '#/components/schemas/TranscriptionEngineSonioxConfig'
            - $ref: '#/components/schemas/TranscriptionEngineParakeetConfig'
            - $ref: '#/components/schemas/TranscriptionEngineAConfig'
            - $ref: '#/components/schemas/TranscriptionEngineBConfig'
          discriminator:
            propertyName: transcription_engine
            mapping:
              Google:
                $ref: '#/components/schemas/TranscriptionEngineGoogleConfig'
              Telnyx:
                $ref: '#/components/schemas/TranscriptionEngineTelnyxConfig'
              Deepgram:
                $ref: '#/components/schemas/TranscriptionEngineDeepgramConfig'
              Azure:
                $ref: '#/components/schemas/TranscriptionEngineAzureConfig'
              xAI:
                $ref: '#/components/schemas/TranscriptionEngineXaiConfig'
              AssemblyAI:
                $ref: '#/components/schemas/TranscriptionEngineAssemblyaiConfig'
              Speechmatics:
                $ref: '#/components/schemas/TranscriptionEngineSpeechmaticsConfig'
              Soniox:
                $ref: '#/components/schemas/TranscriptionEngineSonioxConfig'
              Parakeet:
                $ref: '#/components/schemas/TranscriptionEngineParakeetConfig'
              A:
                $ref: '#/components/schemas/TranscriptionEngineAConfig'
              B:
                $ref: '#/components/schemas/TranscriptionEngineBConfig'
        client_state:
          description: >-
            Use this field to add state to every subsequent webhook. It must be
            a valid Base-64 encoded string.
          type: string
          example: aGF2ZSBhIG5pY2UgZGF5ID1d
        transcription_tracks:
          description: >-
            Indicates which leg of the call will be transcribed. Use `inbound`
            for the leg that requested the transcription, `outbound` for the
            other leg, and `both` for both legs of the call. Will default to
            `inbound`.
          type: string
          example: both
          default: inbound
        command_id:
          description: >-
            Use this field to avoid duplicate commands. Telnyx will ignore any
            command with the same `command_id` for the same `call_control_id`.
          type: string
          example: 891510ac-f3e4-11e8-af5b-de00688a4901
      example:
        transcription_engine: Google
        transcription_engine_config:
          transcription_engine: Google
          language: en
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
    TranscriptionEngineGoogleConfig:
      type: object
      title: Transcription engine Google config
      properties:
        transcription_engine:
          type: string
          enum:
            - Google
          description: Engine identifier for Google transcription service
        language:
          $ref: '#/components/schemas/GoogleTranscriptionLanguage'
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
        enable_speaker_diarization:
          type: boolean
          description: Enables speaker diarization.
          default: false
          example: true
        min_speaker_count:
          description: Defines minimum number of speakers in the conversation.
          type: integer
          example: 4
          default: 2
          format: int32
        max_speaker_count:
          description: Defines maximum number of speakers in the conversation.
          type: integer
          example: 4
          default: 6
          format: int32
        profanity_filter:
          description: Enables profanity_filter.
          type: boolean
          default: false
          example: true
        use_enhanced:
          description: >-
            Enables enhanced transcription, this works for models `phone_call`
            and `video`.
          type: boolean
          default: false
          example: true
        model:
          description: The model to use for transcription.
          type: string
          enum:
            - latest_long
            - latest_short
            - command_and_search
            - phone_call
            - video
            - default
            - medical_conversation
            - medical_dictation
        hints:
          description: Hints to improve transcription accuracy.
          type: array
          items:
            type: string
          default: []
          example: []
        speech_context:
          description: Speech context to improve transcription accuracy.
          type: array
          items:
            type: object
            properties:
              phrases:
                type: array
                items:
                  type: string
                default: []
                example: []
              boost:
                type: number
                description: Boost factor for the speech context.
                default: 1
                minimum: 0
                maximum: 20
                example: 1
    TranscriptionEngineTelnyxConfig:
      type: object
      title: Transcription engine Telnyx config
      properties:
        transcription_engine:
          type: string
          enum:
            - Telnyx
          description: Engine identifier for Telnyx transcription service
        language:
          $ref: '#/components/schemas/TelnyxTranscriptionLanguage'
        transcription_model:
          description: The model to use for transcription.
          type: string
          enum:
            - openai/whisper-tiny
            - openai/whisper-large-v3-turbo
          default: openai/whisper-tiny
    TranscriptionEngineDeepgramConfig:
      oneOf:
        - $ref: '#/components/schemas/DeepgramNova2Config'
        - $ref: '#/components/schemas/DeepgramNova3Config'
      discriminator:
        propertyName: transcription_model
        mapping:
          deepgram/nova-2:
            $ref: '#/components/schemas/DeepgramNova2Config'
          deepgram/nova-3:
            $ref: '#/components/schemas/DeepgramNova3Config'
    TranscriptionEngineAzureConfig:
      type: object
      title: Transcription engine Azure config
      properties:
        transcription_engine:
          type: string
          enum:
            - Azure
          description: Engine identifier for Azure transcription service
        language:
          $ref: '#/components/schemas/AzureTranscriptionLanguage'
        region:
          $ref: '#/components/schemas/AzureTranscriptionRegion'
        api_key_ref:
          type: string
          description: >-
            Reference to the API key for authentication. See [integration
            secrets
            documentation](https://developers.telnyx.com/api/secrets-manager/integration-secrets/create-integration-secret)
            for details. The parameter is optional as defaults are available for
            some regions.
      required:
        - transcription_engine
        - region
    TranscriptionEngineXaiConfig:
      type: object
      title: Transcription engine xAI config
      properties:
        transcription_engine:
          type: string
          enum:
            - xAI
          description: Engine identifier for xAI transcription service
        language:
          $ref: '#/components/schemas/XaiTranscriptionLanguage'
        transcription_model:
          description: The model to use for transcription.
          type: string
          enum:
            - xai/grok-stt
          default: xai/grok-stt
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
    TranscriptionEngineAssemblyaiConfig:
      type: object
      title: Transcription engine AssemblyAI config
      properties:
        transcription_engine:
          type: string
          enum:
            - AssemblyAI
          description: Engine identifier for AssemblyAI transcription service
        transcription_model:
          description: The model to use for transcription.
          type: string
          enum:
            - assemblyai/universal-streaming
          default: assemblyai/universal-streaming
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
    TranscriptionEngineSpeechmaticsConfig:
      type: object
      title: Transcription engine Speechmatics config
      properties:
        transcription_engine:
          type: string
          enum:
            - Speechmatics
          description: Engine identifier for Speechmatics transcription service
        language:
          $ref: '#/components/schemas/SpeechmaticsTranscriptionLanguage'
        transcription_model:
          description: The model to use for transcription.
          type: string
          enum:
            - speechmatics/standard
          default: speechmatics/standard
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
    TranscriptionEngineSonioxConfig:
      type: object
      title: Transcription engine Soniox config
      required:
        - transcription_engine
      properties:
        transcription_engine:
          type: string
          enum:
            - Soniox
          description: Engine identifier for Soniox transcription service
        transcription_model:
          description: The model to use for transcription.
          type: string
          enum:
            - soniox/stt-rt-v4
          default: soniox/stt-rt-v4
        language:
          type: string
          description: >-
            ISO 639-1 language hint (e.g. `en`, `es`), or `auto` to omit the
            hint and let Soniox auto-detect supported languages multilingually.
          default: auto
          example: auto
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
        enable_endpoint_detection:
          type: boolean
          description: >-
            When true, Soniox emits end-of-utterance events at the cadence
            configured by `max_endpoint_delay_ms`.
          default: false
          example: false
        max_endpoint_delay_ms:
          type: integer
          minimum: 500
          maximum: 3000
          description: >-
            Maximum silence (in milliseconds) before Soniox emits an
            end-of-utterance event. Only honored when
            `enable_endpoint_detection` is true. Range: 500-3000 ms.
          example: 1000
    TranscriptionEngineParakeetConfig:
      type: object
      title: Transcription engine Parakeet config
      properties:
        transcription_engine:
          type: string
          enum:
            - Parakeet
          description: Engine identifier for Parakeet transcription service
        transcription_model:
          description: The model to use for transcription.
          type: string
          enum:
            - parakeet/tdt-0.6b-v3
          default: parakeet/tdt-0.6b-v3
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
    TranscriptionEngineAConfig:
      type: object
      title: Transcription engine A config
      properties:
        transcription_engine:
          type: string
          enum:
            - A
          description: Engine identifier for Google transcription service
        language:
          $ref: '#/components/schemas/GoogleTranscriptionLanguage'
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
        enable_speaker_diarization:
          type: boolean
          description: Enables speaker diarization.
          default: false
          example: true
        min_speaker_count:
          description: Defines minimum number of speakers in the conversation.
          type: integer
          example: 4
          default: 2
          format: int32
        max_speaker_count:
          description: Defines maximum number of speakers in the conversation.
          type: integer
          example: 4
          default: 6
          format: int32
        profanity_filter:
          description: Enables profanity_filter.
          type: boolean
          default: false
          example: true
        use_enhanced:
          description: >-
            Enables enhanced transcription, this works for models `phone_call`
            and `video`.
          type: boolean
          default: false
          example: true
        model:
          description: The model to use for transcription.
          type: string
          enum:
            - latest_long
            - latest_short
            - command_and_search
            - phone_call
            - video
            - default
            - medical_conversation
            - medical_dictation
        hints:
          description: Hints to improve transcription accuracy.
          type: array
          items:
            type: string
          default: []
          example:
            - Telnyx
        speech_context:
          description: Speech context to improve transcription accuracy.
          type: array
          items:
            type: object
            properties:
              phrases:
                type: array
                items:
                  type: string
                default: []
                example:
                  - Telnyx
              boost:
                type: number
                description: Boost factor for the speech context.
                default: 1
                minimum: 0
                maximum: 20
                example: 1
    TranscriptionEngineBConfig:
      type: object
      title: Transcription engine B config
      properties:
        transcription_engine:
          type: string
          enum:
            - B
          description: Engine identifier for Telnyx transcription service
        language:
          $ref: '#/components/schemas/TelnyxTranscriptionLanguage'
        transcription_model:
          description: The model to use for transcription.
          type: string
          enum:
            - openai/whisper-tiny
            - openai/whisper-large-v3-turbo
          default: openai/whisper-tiny
    call-control_Errors:
      properties:
        errors:
          type: array
          items:
            $ref: '#/components/schemas/call-control_Error'
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
    TelnyxTranscriptionLanguage:
      title: Telnyx transcription engine list of languages
      type: string
      description: Language to use for speech recognition
      example: en
      default: en
      enum:
        - en
        - zh
        - de
        - es
        - ru
        - ko
        - fr
        - ja
        - pt
        - tr
        - pl
        - ca
        - nl
        - ar
        - sv
        - it
        - id
        - hi
        - fi
        - vi
        - he
        - uk
        - el
        - ms
        - cs
        - ro
        - da
        - hu
        - ta
        - 'no'
        - th
        - ur
        - hr
        - bg
        - lt
        - la
        - mi
        - ml
        - cy
        - sk
        - te
        - fa
        - lv
        - bn
        - sr
        - az
        - sl
        - kn
        - et
        - mk
        - br
        - eu
        - is
        - hy
        - ne
        - mn
        - bs
        - kk
        - sq
        - sw
        - gl
        - mr
        - pa
        - si
        - km
        - sn
        - yo
        - so
        - af
        - oc
        - ka
        - be
        - tg
        - sd
        - gu
        - am
        - yi
        - lo
        - uz
        - fo
        - ht
        - ps
        - tk
        - nn
        - mt
        - sa
        - lb
        - my
        - bo
        - tl
        - mg
        - as
        - tt
        - haw
        - ln
        - ha
        - ba
        - jw
        - su
        - auto_detect
    DeepgramNova2Config:
      type: object
      title: DeepgramNova2Config
      properties:
        transcription_engine:
          type: string
          enum:
            - Deepgram
        transcription_model:
          type: string
          enum:
            - deepgram/nova-2
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
        utterance_end_ms:
          type: integer
          default: 1000
          example: 800
          minimum: 0
          maximum: 5000
          description: >-
            Number of milliseconds of silence to consider an utterance ended.
            Ranges from 0 to 5000 ms.
        language:
          $ref: '#/components/schemas/DeepgramNova2TranscriptionLanguage'
        keywords_boosting:
          type: object
          description: >-
            Keywords and their respective intensifiers (boosting values) to
            improve transcription accuracy for specific words or phrases. The
            intensifier should be a numeric value. Example: `{"snuffleupagus":
            5, "systrom": 2, "krieger": 1}`.
          additionalProperties:
            type: number
            description: >-
              Boost intensifier for the keyword. Higher values increase
              recognition confidence.
          default: null
          example:
            snuffleupagus: 5
            systrom: 2
            krieger: 1
      required:
        - transcription_engine
        - transcription_model
      example:
        transcription_engine: Deepgram
        transcription_model: deepgram/nova-2
        language: en
        keywords_boosting:
          snuffleupagus: 5
          systrom: 2
          krieger: 1
    DeepgramNova3Config:
      type: object
      title: DeepgramNova3Config
      properties:
        transcription_engine:
          type: string
          enum:
            - Deepgram
        transcription_model:
          type: string
          enum:
            - deepgram/nova-3
        interim_results:
          type: boolean
          description: >-
            Whether to send also interim results. If set to false, only final
            results will be sent.
          default: false
          example: true
        utterance_end_ms:
          type: integer
          default: 1000
          example: 800
          minimum: 0
          maximum: 5000
          description: >-
            Number of milliseconds of silence to consider an utterance ended.
            Ranges from 0 to 5000 ms.
        language:
          $ref: '#/components/schemas/DeepgramNova3TranscriptionLanguage'
        keywords_boosting:
          type: object
          description: >-
            Keywords and their respective intensifiers (boosting values) to
            improve transcription accuracy for specific words or phrases. The
            intensifier should be a numeric value. Example: `{"snuffleupagus":
            5, "systrom": 2, "krieger": 1}`.
          additionalProperties:
            type: number
            description: >-
              Boost intensifier for the keyword. Higher values increase
              recognition confidence.
          default: null
          example:
            snuffleupagus: 5
            systrom: 2
            krieger: 1
      required:
        - transcription_engine
        - transcription_model
      example:
        transcription_engine: Deepgram
        transcription_model: deepgram/nova-3
        language: en
        keywords_boosting:
          snuffleupagus: 5
          systrom: 2
          krieger: 1
    AzureTranscriptionLanguage:
      title: Azure transcription engine list of languages
      type: string
      description: Language to use for speech recognition
      example: en
      default: en
      enum:
        - af
        - am
        - ar
        - bg
        - bn
        - bs
        - ca
        - cs
        - cy
        - da
        - de
        - el
        - en
        - es
        - et
        - eu
        - fa
        - fi
        - fr
        - ga
        - gl
        - gu
        - he
        - hi
        - hr
        - hu
        - hy
        - id
        - is
        - it
        - ja
        - ka
        - kk
        - km
        - kn
        - ko
        - lo
        - lt
        - lv
        - mk
        - ml
        - mn
        - mr
        - ms
        - mt
        - my
        - nb
        - ne
        - nl
        - pl
        - ps
        - pt
        - ro
        - ru
        - si
        - sk
        - sl
        - so
        - sq
        - sr
        - sv
        - sw
        - ta
        - te
        - th
        - tr
        - uk
        - ur
        - uz
        - vi
        - wuu
        - yue
        - zh
        - zu
        - auto
    AzureTranscriptionRegion:
      title: Azure transcription engine list of regions
      type: string
      description: Azure region to use for speech recognition
      example: eastus
      enum:
        - australiaeast
        - centralindia
        - eastus
        - northcentralus
        - westeurope
        - westus2
    XaiTranscriptionLanguage:
      title: xAI transcription engine list of languages
      type: string
      description: Language to use for speech recognition
      example: en
      default: en
      enum:
        - ar
        - cs
        - da
        - de
        - en
        - es
        - fa
        - fil
        - fr
        - hi
        - id
        - it
        - ja
        - ko
        - mk
        - ms
        - nl
        - pl
        - pt
        - ro
        - ru
        - sv
        - th
        - tr
        - vi
    SpeechmaticsTranscriptionLanguage:
      title: Speechmatics transcription engine list of languages
      type: string
      description: Language to use for speech recognition
      example: en
      default: en
      enum:
        - en
        - ba
        - eu
        - gl
        - ga
        - mt
        - mn
        - sw
        - ug
        - cy
        - ar_en
        - cmn_en
        - en_ms
        - en_ta
        - tl
        - es-bilingual-en
        - cmn_en_ms_ta
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
    DeepgramNova2TranscriptionLanguage:
      title: Deepgram nova-2 transcription engine list of languages
      type: string
      description: Language to use for speech recognition with nova-2 model
      example: en
      default: en
      enum:
        - bg
        - ca
        - zh
        - zh-CN
        - zh-Hans
        - zh-TW
        - zh-Hant
        - zh-HK
        - cs
        - da
        - da-DK
        - nl
        - en
        - en-US
        - en-AU
        - en-GB
        - en-NZ
        - en-IN
        - et
        - fi
        - nl-BE
        - fr
        - fr-CA
        - de
        - de-CH
        - el
        - hi
        - hu
        - id
        - it
        - ja
        - ko
        - ko-KR
        - lv
        - lt
        - ms
        - 'no'
        - pl
        - pt
        - pt-BR
        - pt-PT
        - ro
        - ru
        - sk
        - es
        - es-419
        - sv
        - sv-SE
        - th
        - th-TH
        - tr
        - uk
        - vi
        - auto_detect
    DeepgramNova3TranscriptionLanguage:
      title: Deepgram nova-3 transcription engine list of languages
      type: string
      description: Language to use for speech recognition with nova-3 model
      example: en
      default: en
      enum:
        - en
        - en-US
        - en-AU
        - en-GB
        - en-IN
        - en-NZ
        - de
        - nl
        - sv
        - sv-SE
        - da
        - da-DK
        - es
        - es-419
        - fr
        - fr-CA
        - pt
        - pt-BR
        - pt-PT
        - auto_detect
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
