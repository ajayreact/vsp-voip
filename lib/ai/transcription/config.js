const SUPPORTED_STT_PROVIDERS = ['noop', 'openai', 'google', 'azure', 'deepgram', 'assemblyai', 'local'];

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

function parseIntOr(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadTranscriptionConfig() {
  const provider = (process.env.STT_PROVIDER || 'noop').trim().toLowerCase();
  const normalizedProvider = SUPPORTED_STT_PROVIDERS.includes(provider) ? provider : 'noop';
  const defaultModel = process.env.STT_MODEL?.trim() || process.env.AI_STT_MODEL?.trim() || 'whisper-1';

  return {
    provider: normalizedProvider,
    defaultModel,
    defaultLanguage: process.env.STT_DEFAULT_LANGUAGE?.trim() || 'en',
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
    googleApiKey: process.env.GOOGLE_SPEECH_API_KEY?.trim() || '',
    azureSpeechKey: process.env.AZURE_SPEECH_KEY?.trim() || '',
    azureSpeechRegion: process.env.AZURE_SPEECH_REGION?.trim() || '',
    deepgramApiKey: process.env.DEEPGRAM_API_KEY?.trim() || '',
    assemblyAiApiKey: process.env.ASSEMBLYAI_API_KEY?.trim() || '',
    localWhisperBaseUrl: process.env.LOCAL_WHISPER_BASE_URL?.trim() || '',
    maxRetries: parseIntOr(process.env.STT_MAX_RETRIES, 2),
    retryBaseDelayMs: parseIntOr(process.env.STT_RETRY_BASE_DELAY_MS, 500),
    requestTimeoutMs: parseIntOr(process.env.STT_REQUEST_TIMEOUT_MS, 120_000),
    maxAudioBytes: parseIntOr(process.env.STT_MAX_AUDIO_BYTES, 25 * 1024 * 1024),
  };
}

let cachedConfig = null;

function getTranscriptionConfig() {
  if (!cachedConfig) cachedConfig = loadTranscriptionConfig();
  return cachedConfig;
}

function resetTranscriptionConfigCache() {
  cachedConfig = null;
}

function validateSttProviderConfiguration(providerName) {
  const config = getTranscriptionConfig();
  const name = (providerName || config.provider || 'noop').toLowerCase();

  switch (name) {
    case 'noop':
      return { valid: true, provider: name, missing: [] };
    case 'openai':
      return {
        valid: Boolean(config.openaiApiKey),
        provider: name,
        missing: config.openaiApiKey ? [] : ['OPENAI_API_KEY'],
      };
    case 'google':
      return {
        valid: Boolean(config.googleApiKey),
        provider: name,
        missing: config.googleApiKey ? [] : ['GOOGLE_SPEECH_API_KEY'],
      };
    case 'azure':
      return {
        valid: Boolean(config.azureSpeechKey && config.azureSpeechRegion),
        provider: name,
        missing: [
          !config.azureSpeechKey ? 'AZURE_SPEECH_KEY' : null,
          !config.azureSpeechRegion ? 'AZURE_SPEECH_REGION' : null,
        ].filter(Boolean),
      };
    case 'deepgram':
      return {
        valid: Boolean(config.deepgramApiKey),
        provider: name,
        missing: config.deepgramApiKey ? [] : ['DEEPGRAM_API_KEY'],
      };
    case 'assemblyai':
      return {
        valid: Boolean(config.assemblyAiApiKey),
        provider: name,
        missing: config.assemblyAiApiKey ? [] : ['ASSEMBLYAI_API_KEY'],
      };
    case 'local':
      return {
        valid: Boolean(config.localWhisperBaseUrl),
        provider: name,
        missing: config.localWhisperBaseUrl ? [] : ['LOCAL_WHISPER_BASE_URL'],
      };
    default:
      return { valid: false, provider: name, missing: ['UNKNOWN_STT_PROVIDER'] };
  }
}

module.exports = {
  SUPPORTED_STT_PROVIDERS,
  getTranscriptionConfig,
  resetTranscriptionConfigCache,
  validateSttProviderConfiguration,
};
