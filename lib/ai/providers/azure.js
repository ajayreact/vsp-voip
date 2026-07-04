const { getAiConfig } = require('../config');
const { AiProviderError } = require('../errors');
const { OpenAiProvider } = require('./openai');

/**
 * Azure OpenAI uses the OpenAI chat completions API with a deployment-specific URL.
 */
class AzureOpenAiProvider extends OpenAiProvider {
  get name() {
    return 'azure';
  }

  get endpoint() {
    return (this.config.azureOpenAiEndpoint || getAiConfig().azureOpenAiEndpoint).replace(/\/$/, '');
  }

  get apiKey() {
    return this.config.azureOpenAiApiKey || getAiConfig().azureOpenAiApiKey;
  }

  get deployment() {
    return this.config.azureOpenAiDeployment || getAiConfig().azureOpenAiDeployment;
  }

  async request(_path, body, stream = false) {
    if (!this.endpoint || !this.apiKey || !this.deployment) {
      throw new AiProviderError('Azure OpenAI is not configured', this.name, 503);
    }

    const config = getAiConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    const apiVersion = getAiConfig().azureOpenAiApiVersion;
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${apiVersion}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...body, model: undefined }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new AiProviderError(`Azure OpenAI request failed (${response.status})`, this.name, response.status, {
          body: text.slice(0, 200),
        });
      }

      if (stream) return response;
      return response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AiProviderError('Azure OpenAI request timed out', this.name, 504);
      }
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(error.message || 'Azure OpenAI request failed', this.name, 502);
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { AzureOpenAiProvider };
