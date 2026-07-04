const { BaseProvider } = require('./base');

class NoopProvider extends BaseProvider {
  get name() {
    return 'noop';
  }

  async complete(request) {
    return {
      content: '',
      model: request.model || 'noop',
      inputTokens: 0,
      outputTokens: 0,
      finishReason: 'noop',
      provider: this.name,
    };
  }

  async *stream(request) {
    yield { type: 'delta', content: '' };
    yield {
      type: 'done',
      model: request.model || 'noop',
      inputTokens: 0,
      outputTokens: 0,
      finishReason: 'noop',
      provider: this.name,
    };
  }
}

module.exports = { NoopProvider };
