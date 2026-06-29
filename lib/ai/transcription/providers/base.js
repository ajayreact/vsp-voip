const { AiTranscriptionProviderError } = require('../errors');

class BaseTranscriptionProvider {
  constructor(config = {}) {
    this.config = config;
  }

  get name() {
    return 'base';
  }

  async transcribe(_request) {
    throw new AiTranscriptionProviderError('Transcription provider not implemented', this.name, 501);
  }
}

module.exports = { BaseTranscriptionProvider };
