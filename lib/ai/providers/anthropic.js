const { getAiConfig } = require('../config');
const { AiProviderError } = require('../errors');
const { BaseProvider } = require('./base');

class AnthropicProvider extends BaseProvider {
  get name() {
    return 'anthropic';
  }

  get apiKey() {
    return this.config.anthropicApiKey || getAiConfig().anthropicApiKey;
  }

  async complete(request) {
    const response = await this.request('/messages', {
      model: request.model,
      messages: this.mapMessages(request.messages),
      system: this.extractSystem(request.messages),
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature ?? 0.2,
      stream: false,
    });

    const text = (response.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content: text,
      model: response.model || request.model,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      finishReason: response.stop_reason || 'end_turn',
      provider: this.name,
    };
  }

  async *stream(request) {
    const response = await this.request('/messages', {
      model: request.model,
      messages: this.mapMessages(request.messages),
      system: this.extractSystem(request.messages),
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature ?? 0.2,
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
        if (!payload) continue;
        const parsed = JSON.parse(payload);
        if (parsed.type === 'message_start') {
          model = parsed.message?.model || model;
        }
        if (parsed.type === 'content_block_delta') {
          const delta = parsed.delta?.text;
          if (delta) {
            outputTokens += Math.ceil(delta.length / 4);
            yield { type: 'delta', content: delta };
          }
        }
        if (parsed.type === 'message_delta' && parsed.usage) {
          outputTokens = parsed.usage.output_tokens || outputTokens;
        }
        if (parsed.type === 'message_start' && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens || inputTokens;
        }
      }
    }

    yield {
      type: 'done',
      model,
      inputTokens,
      outputTokens,
      finishReason: 'end_turn',
      provider: this.name,
    };
  }

  extractSystem(messages = []) {
    return messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n');
  }

  mapMessages(messages = []) {
    return messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
      }));
  }

  async request(path, body, stream = false) {
    if (!this.apiKey) {
      throw new AiProviderError('Anthropic API key is not configured', this.name, 503);
    }

    const config = getAiConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch(`https://api.anthropic.com/v1${path}`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AiProviderError(`Anthropic request failed (${response.status})`, this.name, response.status, {
          body: text.slice(0, 200),
        });
      }

      if (stream) return response;
      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AiProviderError('Anthropic request timed out', this.name, 504);
      }
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(error.message || 'Anthropic request failed', this.name, 502);
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { AnthropicProvider };
