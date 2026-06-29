const { BaseTranscriptionProvider } = require('./base');

class NoopTranscriptionProvider extends BaseTranscriptionProvider {
  get name() {
    return 'noop';
  }

  async transcribe(request) {
    return {
      transcript: '',
      confidence: 0,
      detectedLanguage: request.language || 'en',
      provider: this.name,
      model: request.model || 'noop',
      durationSeconds: request.durationSeconds ?? null,
    };
  }
}

module.exports = { NoopTranscriptionProvider };
