const { getAiConfig } = require('../config');
const { GeminiProvider } = require('./gemini');
const { NoopProvider } = require('./noop');
const { OpenAiProvider } = require('./openai');
const { AnthropicProvider } = require('./anthropic');
const { AzureOpenAiProvider } = require('./azure');
const { BaseProvider } = require('./base');

class LocalLlmProvider extends BaseProvider {
  get name() {
    return 'local';
  }

  async complete(request) {
    const baseUrl = (this.config.localLlmBaseUrl || getAiConfig().localLlmBaseUrl).replace(/\/$/, '');
    if (!baseUrl) {
      return new NoopProvider(this.config).complete(request);
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || 'local',
        messages: request.messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Local LLM request failed (${response.status})`);
    }

    const json = await response.json();
    const choice = json.choices?.[0];
    return {
      content: choice?.message?.content || '',
      model: json.model || request.model || 'local',
      inputTokens: json.usage?.prompt_tokens || 0,
      outputTokens: json.usage?.completion_tokens || 0,
      finishReason: choice?.finish_reason || 'stop',
      provider: this.name,
    };
  }

  async *stream(request) {
    const result = await this.complete(request);
    if (result.content) yield { type: 'delta', content: result.content };
    yield { type: 'done', ...result };
  }
}

function createAiProvider(providerName, overrides = {}) {
  const config = { ...getAiConfig(), ...overrides };
  const name = (providerName || config.provider || 'noop').toLowerCase();

  switch (name) {
    case 'gemini':
      return new GeminiProvider(config);
    case 'openai':
      return new OpenAiProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'azure':
      return new AzureOpenAiProvider(config);
    case 'local':
      return new LocalLlmProvider(config);
    case 'noop':
    default:
      return new NoopProvider(config);
  }
}

module.exports = {
  createAiProvider,
  NoopProvider,
  GeminiProvider,
  OpenAiProvider,
  AnthropicProvider,
  AzureOpenAiProvider,
  LocalLlmProvider,
};
