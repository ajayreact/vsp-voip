import { describe, it, expect, beforeEach } from 'vitest';

const {
  createAiProvider,
  renderPrompt,
  registerPrompt,
  createContext,
  redactSecrets,
  assertSafeForProvider,
  isPlatformAiEnabled,
  isTenantAiEnabled,
  isFeatureEnabled,
  normalizeTenantSettings,
  calculateCostMicros,
  withAiRetry,
  AiDisabledError,
  AiRedactionError,
  isRetryableAiError,
  resetAiConfigCache,
} = require('../../lib/ai');

describe('AI provider abstraction', () => {
  it('creates noop provider by default', async () => {
    const provider = createAiProvider('noop');
    const result = await provider.complete({
      model: 'noop',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(result.provider).toBe('noop');
    expect(result.finishReason).toBe('noop');
  });

  it('streams noop completion chunks', async () => {
    const provider = createAiProvider('noop');
    const chunks = [];
    for await (const chunk of provider.stream({
      model: 'noop',
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      chunks.push(chunk);
    }
    expect(chunks.some((chunk) => chunk.type === 'done')).toBe(true);
  });
});

describe('prompt management', () => {
  it('renders versioned prompts with variables', () => {
    const { renderPromptVersion } = require('../../lib/ai');
    const rendered = renderPromptVersion('call_summary', 1, {
      transcript: 'Agent: Hello',
      tenantName: 'Acme',
    });
    expect(rendered).toContain('Agent: Hello');
    expect(rendered).toContain('valid JSON');
  });

  it('registers custom legacy prompts', () => {
    registerPrompt('custom.test', 'Hello {{name}}');
    expect(renderPrompt('custom.test', { name: 'VSP' })).toBe('Hello VSP');
  });
});

describe('context management', () => {
  it('trims message history to max size', () => {
    const ctx = createContext({ tenantId: 't1', maxMessages: 3 });
    ctx.addUser('one');
    ctx.addUser('two');
    ctx.addUser('three');
    ctx.addUser('four');
    expect(ctx.snapshot().messageCount).toBe(3);
  });

  it('applies redaction when exporting provider messages', () => {
    const ctx = createContext({ tenantId: 't1' });
    ctx.addUser('token Bearer abc.def.ghi');
    const messages = ctx.toProviderMessages();
    expect(messages[0].content).toContain('[REDACTED]');
  });
});

describe('feature flags', () => {
  beforeEach(() => {
    process.env.AI_ENABLED = 'true';
    resetAiConfigCache();
  });

  it('requires platform and tenant enablement', () => {
    expect(isPlatformAiEnabled()).toBe(true);
    const settings = normalizeTenantSettings({ enabled: false });
    expect(isTenantAiEnabled(settings)).toBe(false);
    const enabled = normalizeTenantSettings({ enabled: true, features: { transcription: true } });
    expect(isTenantAiEnabled(enabled)).toBe(true);
    expect(isFeatureEnabled(enabled, 'transcription')).toBe(true);
    expect(isFeatureEnabled(enabled, 'call_summary')).toBe(false);
  });
});

describe('redaction and security', () => {
  it('redacts JWT-like tokens', () => {
    const text = 'Authorization eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig';
    expect(redactSecrets(text)).not.toContain('eyJ');
  });

  it('blocks unsafe provider payloads', () => {
    const safe = assertSafeForProvider([{ role: 'user', content: 'Business summary please' }]);
    const unsafe = assertSafeForProvider([{ role: 'user', content: 'password: secret123' }]);
    expect(safe).toBe(true);
    expect(unsafe).toBe(false);
  });
});

describe('cost tracking', () => {
  it('calculates token cost in microdollars', () => {
    const cost = calculateCostMicros('gpt-4o-mini', 1000, 500);
    expect(cost).toBeGreaterThan(0);
  });
});

describe('retry policy', () => {
  it('retries retryable provider errors', async () => {
    let attempts = 0;
    const result = await withAiRetry(async () => {
      attempts += 1;
      if (attempts < 2) {
        const error = new Error('rate limited');
        error.code = 'AI_PROVIDER_ERROR';
        error.status = 429;
        throw error;
      }
      return 'ok';
    }, { attempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('identifies retryable errors', () => {
    const { AiProviderError } = require('../../lib/ai/errors');
    const retryable = new AiProviderError('upstream', 'openai', 503);
    expect(isRetryableAiError(retryable)).toBe(true);
    expect(isRetryableAiError(new AiRedactionError())).toBe(false);
  });
});

describe('error handling', () => {
  it('maps disabled AI to 403', () => {
    const error = new AiDisabledError();
    expect(error.status).toBe(403);
    expect(error.code).toBe('AI_DISABLED');
  });
});
