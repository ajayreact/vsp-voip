const { AiProviderError } = require('../errors');

class BaseProvider {
  constructor(config = {}) {
    this.config = config;
  }

  get name() {
    return 'base';
  }

  async complete(_request) {
    throw new AiProviderError('Provider not implemented', this.name, 501);
  }

  async *stream(_request) {
    throw new AiProviderError('Streaming not implemented', this.name, 501);
  }
}

module.exports = {
  BaseProvider,
};
