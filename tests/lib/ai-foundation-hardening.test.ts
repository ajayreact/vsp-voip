import { describe, it, expect, beforeEach } from 'vitest';

const {
  createAiProvider,
  providerManager,
  renderPromptVersion,
  listPromptVersions,
  getPromptMetadata,
  getFailoverChain,
  validateProviderConfiguration,
  normalizeTenantSettings,
  AiBudgetExceededError,
  runCompletion,
  resetAiConfigCache,
  resetHealthState,
  redactSecrets,
  assertSafeForProvider,
} = require('../../lib/ai');

describe('Gemini provider', () => {
  it('registers gemini in provider factory', () => {
    const provider = createAiProvider('gemini');
    expect(provider.name).toBe('gemini');
  });

  it('validates gemini configuration', () => {
    process.env.GEMINI_API_KEY = '';
    resetAiConfigCache();
    const status = validateProviderConfiguration('gemini');
    expect(status.valid).toBe(false);
    expect(status.missing).toContain('GEMINI_API_KEY');
  });
});

describe('provider manager', () => {
  beforeEach(() => {
    resetHealthState();
    providerManager.initialize();
  });

  it('lists supported providers', () => {
    expect(providerManager.listProviders()).toContain('gemini');
    expect(providerManager.listProviders()).toContain('noop');
  });

  it('returns configuration validation', () => {
    const status = providerManager.validateConfiguration('noop');
    expect(status.valid).toBe(true);
  });
});

describe('AI gateway policies', () => {
  beforeEach(() => {
    process.env.AI_ENABLED = 'true';
    resetAiConfigCache();
  });

  it('enforces monthly budget hard stop', async () => {
    const prisma = {
      tenantAiSettings: {
        findUnique: async () => ({
          enabled: true,
          allowedProvider: 'noop',
          allowedModel: null,
          features: {},
          piiRedactionEnabled: true,
          dailyBudgetCents: null,
          monthlyBudgetCents: 1,
          maxTokens: null,
          temperature: null,
          streamingEnabled: true,
        }),
      },
      aiUsageLog: {
        findMany: async () => [{ costMicros: 1_000_000, inputTokens: 0, outputTokens: 0, status: 'success' }],
        create: async (data) => data.data,
      },
    };

    await expect(
      runCompletion(prisma, {
        tenantId: 'tenant-1',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
  });
});

describe('prompt versioning', () => {
  it('loads versioned prompt files with metadata', () => {
    const versions = listPromptVersions('call_summary');
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(versions[0].checksum).toHaveLength(64);
    expect(getPromptMetadata('call_summary', 1)?.author).toBe('vsp-platform');
  });

  it('never overwrites versions and renders specific revision', () => {
    const v1 = renderPromptVersion('call_summary', 1, { transcript: 'A', tenantName: 'Acme' });
    const v2 = renderPromptVersion('call_summary', 2, { transcript: 'B', maxBullets: 4, tenantName: 'Acme' });
    expect(v1).toContain('valid JSON');
    expect(v2).toContain('enterprise call analyst');
  });
});

describe('failover framework', () => {
  beforeEach(() => {
    process.env.AI_FAILOVER_ENABLED = 'false';
    resetAiConfigCache();
  });

  it('returns primary only when disabled', () => {
    expect(getFailoverChain('gemini')).toEqual(['gemini']);
  });

  it('builds configured chain when enabled', () => {
    process.env.AI_FAILOVER_ENABLED = 'true';
    resetAiConfigCache();
    expect(getFailoverChain('gemini')).toEqual(['gemini', 'openai', 'noop']);
  });
});

describe('security redaction hardening', () => {
  it('redacts authorization headers and cookies', () => {
    const text = 'Authorization: Bearer abc123\nCookie: session=secret';
    const redacted = redactSecrets(text);
    expect(redacted).not.toContain('abc123');
    expect(redacted).not.toContain('session=secret');
  });

  it('rejects sip password payloads', () => {
    expect(assertSafeForProvider([{ role: 'user', content: 'sip_password=abc123' }])).toBe(false);
  });
});

describe('tenant policy normalization', () => {
  it('maps policy fields and aliases', () => {
    const settings = normalizeTenantSettings({
      enabled: true,
      allowedProvider: 'gemini',
      allowedModel: 'gemini-2.5-flash',
      dailyBudgetCents: 100,
      monthlyBudgetCents: 1000,
      maxTokens: 512,
      temperature: 0.3,
      streamingEnabled: false,
    });
    expect(settings.provider).toBe('gemini');
    expect(settings.defaultModel).toBe('gemini-2.5-flash');
    expect(settings.streamingEnabled).toBe(false);
  });
});
