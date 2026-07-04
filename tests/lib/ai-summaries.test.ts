import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  parseAiJsonResponse,
  normalizeStructuredSummary,
  buildVoicemailTranscript,
  buildCallTranscript,
  buildConversationTranscript,
  getMessageSummaryThreshold,
  resetSummaryQueueForTests,
  resetAiConfigCache,
  renderPromptVersion,
  assertSafeForProvider,
} = require('../../lib/ai');

describe('structured output', () => {
  it('parses JSON and strips code fences', () => {
    const parsed = parseAiJsonResponse('```json\n{"summary":"Hello","keyPoints":[],"actionItems":[],"priority":"High","sentiment":"Neutral","confidence":0.9}\n```');
    const normalized = normalizeStructuredSummary(parsed, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      moduleType: 'voicemail',
    });
    expect(normalized.summary).toBe('Hello');
    expect(normalized.priority).toBe('High');
    expect(normalized.provider).toBe('gemini');
    expect(normalized.callbackRecommendation).toBeDefined();
  });

  it('rejects malformed AI responses', () => {
    expect(() => parseAiJsonResponse('not json')).toThrow(/valid JSON/i);
  });

  it('normalizes call summary module fields', () => {
    const parsed = parseAiJsonResponse(
      JSON.stringify({
        summary: 'Deal discussed',
        executiveSummary: 'Enterprise deal',
        keyPoints: ['Pricing'],
        discussionTopics: ['Pricing'],
        customerIntent: 'Purchase',
        actionItems: ['Send quote'],
        followUpTasks: ['Send quote'],
        sentiment: 'Positive',
        salesOpportunity: 'High',
        priority: 'Medium',
        confidence: 0.88,
      }),
    );
    const normalized = normalizeStructuredSummary(parsed, {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      moduleType: 'call',
    });
    expect(normalized.executiveSummary).toBe('Enterprise deal');
    expect(normalized.salesOpportunity).toBe('High');
  });
});

describe('prompt templates', () => {
  it('renders JSON-oriented voicemail prompt v1', () => {
    const prompt = renderPromptVersion('voicemail_summary', 1, { transcript: 'Please call back', tenantName: 'Acme' });
    expect(prompt).toContain('valid JSON');
    expect(prompt).toContain('Please call back');
  });

  it('renders message summary prompt v1', () => {
    const prompt = renderPromptVersion('message_summary', 1, {
      transcript: 'Customer: Hi\nAgent: Hello',
      tenantName: 'Acme',
      messageCount: 12,
    });
    expect(prompt).toContain('12 messages');
    expect(prompt).toContain('valid JSON');
  });
});

describe('transcript builders', () => {
  it('builds voicemail fallback transcript', async () => {
    const { buildVoicemailTranscript } = require('../../lib/ai/modules/voicemailSummary');
    const text = await buildVoicemailTranscript(null, null, { from: '+15551234567', durationSeconds: 42 }, null);
    expect(text).toContain('+15551234567');
    expect(text).toContain('42');
  });

  it('builds conversation transcript from messages', () => {
    const { buildConversationTranscript } = require('../../lib/ai/modules/messageSummary');
    const text = buildConversationTranscript([
      { direction: 'INBOUND', body: 'Need help' },
      { direction: 'OUTBOUND', body: 'Sure' },
    ]);
    expect(text).toContain('Customer: Need help');
    expect(text).toContain('Agent: Sure');
  });

  it('uses call metadata when transcript missing', async () => {
    const { buildCallTranscript } = require('../../lib/ai/modules/callSummary');
    const text = await buildCallTranscript(null, null, {
      direction: 'inbound',
      from: '+1',
      to: '+2',
      durationSeconds: 90,
      status: 'completed',
    });
    expect(text).toContain('inbound');
    expect(text).toContain('90');
  });
});

describe('message summary threshold', () => {
  beforeEach(() => {
    process.env.AI_MESSAGE_SUMMARY_MIN_MESSAGES = '10';
    resetAiConfigCache();
  });

  it('defaults to configurable minimum messages', () => {
    expect(getMessageSummaryThreshold()).toBe(10);
  });
});

describe('summary queue isolation', () => {
  beforeEach(() => {
    resetSummaryQueueForTests();
  });

  it('schedules async jobs without blocking', async () => {
    const { scheduleSummaryJob, getPendingJobCount } = require('../../lib/ai/modules/summaryQueue');
    let executed = false;
    scheduleSummaryJob('test', async () => {
      executed = true;
    });
    expect(getPendingJobCount()).toBe(1);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    expect(executed).toBe(true);
  });
});

describe('gateway integration (mocked)', () => {
  beforeEach(() => {
    resetSummaryQueueForTests();
    resetAiConfigCache();
    process.env.AI_ENABLED = 'true';
  });

  it('generates voicemail summary via gateway mock', async () => {
    const summaryEnginePath = require.resolve('../../lib/ai/modules/summaryEngine');
    const voicemailSummaryPath = require.resolve('../../lib/ai/modules/voicemailSummary');
    delete require.cache[voicemailSummaryPath];

    const summaryEngine = require(summaryEnginePath);
    vi.spyOn(summaryEngine, 'resolveSummaryAvailability').mockResolvedValue({
      available: true,
      feature: 'voicemail_summary',
      settings: { enabled: true, features: { voicemail_summary: true } },
    });
    const executeSpy = vi.spyOn(summaryEngine, 'executeSummaryGeneration').mockResolvedValue({
      id: 'sum-1',
      tenantId: 'tenant-1',
      entityType: 'voicemail',
      entityId: 'vm-1',
      status: 'completed',
      result: {
        summary: 'Customer requested callback regarding invoice #2048.',
        keyPoints: ['Invoice #2048'],
        actionItems: ['Return the call', 'Verify invoice'],
        priority: 'High',
        sentiment: 'Neutral',
        confidence: 0.95,
        callbackRecommendation: 'Recommended',
        generatedAt: new Date().toISOString(),
        provider: 'gemini',
        model: 'gemini-2.5-flash',
      },
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      confidence: 0.95,
      generatedAt: new Date().toISOString(),
    });

    const prisma = {
      voicemail: {
        findFirst: async () => ({
          id: 'vm-1',
          tenantId: 'tenant-1',
          from: '+15551234567',
          durationSeconds: 30,
        }),
      },
    };

    const { requestVoicemailSummary } = require(voicemailSummaryPath);
    const result = await requestVoicemailSummary(prisma, {
      tenantId: 'tenant-1',
      voicemailId: 'vm-1',
      userId: 'user-1',
      async: false,
    });

    expect(executeSpy).toHaveBeenCalled();
    expect(result.summary.status).toBe('completed');
    expect(result.summary.result.summary).toContain('invoice #2048');
    executeSpy.mockRestore();
    delete require.cache[voicemailSummaryPath];
  });
});

describe('redaction on summary transcripts', () => {
  it('blocks bearer tokens in transcript content', () => {
    expect(assertSafeForProvider([{ role: 'user', content: 'Authorization: Bearer secret-token' }])).toBe(false);
  });
});
