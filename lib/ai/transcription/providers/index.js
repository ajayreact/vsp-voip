const { getTranscriptionConfig, validateSttProviderConfiguration } = require('../config');
const { AiTranscriptionProviderError } = require('../errors');
const { BaseTranscriptionProvider } = require('./base');
const { NoopTranscriptionProvider } = require('./noop');
const { OpenAiWhisperProvider } = require('./openai');

function createStubProvider(name, envLabel) {
  return class StubTranscriptionProvider extends BaseTranscriptionProvider {
    get name() {
      return name;
    }

    async transcribe(request) {
      const config = getTranscriptionConfig();
      const status = validateSttProviderConfiguration(name);
      if (!status.valid) {
        return new NoopTranscriptionProvider(config).transcribe(request);
      }
      throw new AiTranscriptionProviderError(
        `${envLabel} transcription is not implemented yet`,
        this.name,
        501,
      );
    }
  };
}

class LocalWhisperProvider extends BaseTranscriptionProvider {
  get name() {
    return 'local';
  }

  async transcribe(request) {
    const config = { ...getTranscriptionConfig(), ...this.config };
    const baseUrl = config.localWhisperBaseUrl?.replace(/\/$/, '');
    if (!baseUrl) {
      return new NoopTranscriptionProvider(config).transcribe(request);
    }

    const response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || 'local-whisper',
        language: request.language,
        audio_base64: request.audioBuffer?.toString('base64'),
      }),
    });

    if (!response.ok) {
      throw new AiTranscriptionProviderError(`Local Whisper failed (${response.status})`, this.name, 502);
    }

    const json = await response.json();
    return {
      transcript: String(json.text || json.transcript || '').trim(),
      confidence: Number(json.confidence ?? 0.8),
      detectedLanguage: json.language || request.language || config.defaultLanguage,
      provider: this.name,
      model: json.model || request.model || 'local-whisper',
      durationSeconds: request.durationSeconds ?? null,
    };
  }
}

const GoogleSpeechProvider = createStubProvider('google', 'Google Speech-to-Text');
const AzureSpeechProvider = createStubProvider('azure', 'Azure Speech');
const DeepgramProvider = createStubProvider('deepgram', 'Deepgram');
const AssemblyAiProvider = createStubProvider('assemblyai', 'AssemblyAI');

function createTranscriptionProvider(providerName, overrides = {}) {
  const config = { ...getTranscriptionConfig(), ...overrides };
  const name = (providerName || config.provider || 'noop').toLowerCase();

  switch (name) {
    case 'openai':
      return new OpenAiWhisperProvider(config);
    case 'google':
      return new GoogleSpeechProvider(config);
    case 'azure':
      return new AzureSpeechProvider(config);
    case 'deepgram':
      return new DeepgramProvider(config);
    case 'assemblyai':
      return new AssemblyAiProvider(config);
    case 'local':
      return new LocalWhisperProvider(config);
    case 'noop':
    default:
      return new NoopTranscriptionProvider(config);
  }
}

module.exports = {
  createTranscriptionProvider,
  NoopTranscriptionProvider,
  OpenAiWhisperProvider,
  GoogleSpeechProvider,
  AzureSpeechProvider,
  DeepgramProvider,
  AssemblyAiProvider,
  LocalWhisperProvider,
};
