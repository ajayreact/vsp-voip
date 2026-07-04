const { AiError } = require('../errors');

class AiTranscriptionError extends AiError {
  constructor(message, code = 'AI_TRANSCRIPTION_ERROR', status = 500, details = null) {
    super(message, code, status, details);
    this.name = 'AiTranscriptionError';
  }
}

class AiTranscriptionDisabledError extends AiTranscriptionError {
  constructor(message = 'Transcription is disabled for this organization') {
    super(message, 'AI_TRANSCRIPTION_DISABLED', 403);
    this.name = 'AiTranscriptionDisabledError';
  }
}

class AiTranscriptionProviderError extends AiTranscriptionError {
  constructor(message, provider, status = 502, details = null) {
    super(message, 'AI_TRANSCRIPTION_PROVIDER_ERROR', status, { provider, ...(details || {}) });
    this.name = 'AiTranscriptionProviderError';
  }
}

function isRetryableTranscriptionError(error) {
  if (!error) return false;
  if (error.code === 'AI_TRANSCRIPTION_PROVIDER_ERROR') {
    const status = error.status || 0;
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
  return false;
}

module.exports = {
  AiTranscriptionError,
  AiTranscriptionDisabledError,
  AiTranscriptionProviderError,
  isRetryableTranscriptionError,
};
