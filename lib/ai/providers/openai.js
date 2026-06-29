const { getAiConfig } = require('../config');
const { AiProviderError } = require('../errors');
const { BaseProvider } = require('./base');

class OpenAiProvider extends BaseProvider {
  get name() {
    return 'openai';
  }

  get apiKey() {
    return this.config.openaiApiKey || getAiConfig().openaiApiKey;
  }

  async complete(request) {
    const response = await this.request('/chat/completions', {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens,
      stream: false,
    });

    const choice = response.choices?.[0];
    return {
      content: choice?.message?.content || '',
      model: response.model || request.model,
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0,
      finishReason: choice?.finish_reason || 'stop',
      provider: this.name,
    };
  }

  async *stream(request) {
    const response = await this.request('/chat/completions', {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens,
      stream: true,
    }, true);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let model = request.model;
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        const parsed = JSON.parse(payload);
        model = parsed.model || model;
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          outputTokens += Math.ceil(delta.length / 4);
          yield { type: 'delta', content: delta };
        }
        if (parsed.usage) {
          inputTokens = parsed.usage.prompt_tokens || inputTokens;
          outputTokens = parsed.usage.completion_tokens || outputTokens;
        }
      }
    }

    yield {
      type: 'done',
      model,
      inputTokens,
      outputTokens,
      finishReason: 'stop',
      provider: this.name,
    };
  }

  async request(path, body, stream = false) {
    if (!this.apiKey) {
      throw new AiProviderError('OpenAI API key is not configured', this.name, 503);
    }

    const config = getAiConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(`https://api.openai.com/v1${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AiProviderError(`OpenAI request failed (${response.status})`, this.name, response.status, {
          body: text.slice(0, 200),
        });
      }

      if (stream) return response;

      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AiProviderError('OpenAI request timed out', this.name, 504);
      }
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(error.message || 'OpenAI request failed', this.name, 502);
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { OpenAiProvider };
