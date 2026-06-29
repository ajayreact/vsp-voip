const { getAiConfig } = require('../config');
const { AiProviderError } = require('../errors');
const { BaseProvider } = require('./base');

function mapGeminiContents(messages = []) {
  const systemParts = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n');

  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  return { systemInstruction: systemParts || undefined, contents };
}

class GeminiProvider extends BaseProvider {
  get name() {
    return 'gemini';
  }

  get apiKey() {
    return this.config.geminiApiKey || getAiConfig().geminiApiKey;
  }

  getClient() {
    if (!this._client) {
      if (!this.apiKey) {
        throw new AiProviderError('Gemini API key is not configured', this.name, 503);
      }
      // eslint-disable-next-line global-require
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      this._client = new GoogleGenerativeAI(this.apiKey);
    }
    return this._client;
  }

  resolveModel(request) {
    return request.model || getAiConfig().defaultModel;
  }

  buildModel(request) {
    const { systemInstruction, contents } = mapGeminiContents(request.messages);
    return this.getClient().getGenerativeModel({
      model: this.resolveModel(request),
      systemInstruction,
      generationConfig: {
        temperature: request.temperature ?? 0.2,
        maxOutputTokens: request.maxTokens,
      },
    }).startChat({ history: contents.slice(0, -1) });
  }

  lastUserMessage(messages = []) {
    const users = messages.filter((message) => message.role === 'user');
    return users[users.length - 1]?.content || '';
  }

  async complete(request) {
    const modelName = this.resolveModel(request);
    const started = Date.now();
    const chat = this.buildModel(request);
    const response = await this.withTimeout(
      chat.sendMessage(this.lastUserMessage(request.messages)),
      getAiConfig().requestTimeoutMs,
    );
    const text = response.response.text();
    const usage = response.response.usageMetadata || {};

    return {
      content: text,
      model: modelName,
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      finishReason: 'stop',
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }

  async *stream(request) {
    const modelName = this.resolveModel(request);
    const chat = this.buildModel(request);
    const stream = await this.withTimeout(
      chat.sendMessageStream(this.lastUserMessage(request.messages)),
      getAiConfig().requestTimeoutMs,
    );

    let outputTokens = 0;
    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) {
        outputTokens += Math.ceil(text.length / 4);
        yield { type: 'delta', content: text };
      }
    }

    const aggregated = await stream.response;
    const usage = aggregated.usageMetadata || {};

    yield {
      type: 'done',
      model: modelName,
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || outputTokens,
      finishReason: 'stop',
      provider: this.name,
    };
  }

  async withTimeout(promise, timeoutMs) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new AiProviderError('Gemini request timed out', this.name, 504);
        reject(error);
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { GeminiProvider };
