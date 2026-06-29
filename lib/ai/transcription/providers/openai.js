const { Blob } = require('buffer');
const { getTranscriptionConfig } = require('../config');
const { AiTranscriptionProviderError } = require('../errors');
const { BaseTranscriptionProvider } = require('./base');

class OpenAiWhisperProvider extends BaseTranscriptionProvider {
  get name() {
    return 'openai';
  }

  async transcribe(request) {
    const config = { ...getTranscriptionConfig(), ...this.config };
    const apiKey = config.openaiApiKey;
    if (!apiKey) {
      throw new AiTranscriptionProviderError('OpenAI API key is not configured', this.name, 503);
    }
    if (!request.audioBuffer?.length) {
      throw new AiTranscriptionProviderError('Audio buffer is empty', this.name, 400);
    }

    const model = request.model || config.defaultModel || 'whisper-1';
    const form = new FormData();
    form.append(
      'file',
      new Blob([request.audioBuffer], { type: request.contentType || 'audio/mpeg' }),
      request.fileName || 'recording.mp3',
    );
    form.append('model', model);
    if (request.language && request.detectLanguage !== true) {
      form.append('language', request.language);
    }
    form.append('response_format', 'verbose_json');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new AiTranscriptionProviderError(
          `OpenAI transcription failed (${response.status})`,
          this.name,
          response.status >= 500 ? 502 : response.status,
          { body: body.slice(0, 200) },
        );
      }

      const json = await response.json();
      const segments = Array.isArray(json.segments) ? json.segments : [];
      const avgLogprob = segments.length
        ? segments.reduce((sum, seg) => sum + (seg.avg_logprob ?? -0.5), 0) / segments.length
        : -0.5;
      const confidence = Math.min(1, Math.max(0, 1 + avgLogprob));

      return {
        transcript: String(json.text || '').trim(),
        confidence,
        detectedLanguage: json.language || request.language || config.defaultLanguage,
        provider: this.name,
        model,
        durationSeconds: request.durationSeconds ?? (json.duration ? Math.round(json.duration) : null),
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new AiTranscriptionProviderError('OpenAI transcription timed out', this.name, 504);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = { OpenAiWhisperProvider };
