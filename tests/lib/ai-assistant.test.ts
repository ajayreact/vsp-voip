import { describe, it, expect, beforeEach } from 'vitest';

const {
  classifyIntent,
  extractSearchTerms,
  parseAssistantResponse,
  normalizeAssistantResponse,
  buildAssistantContext,
  getCachedResponse,
  setCachedResponse,
  resetQueryCacheForTests,
  getSuggestedPrompts,
} = require('../../lib/ai/assistant');

describe('intent classification', () => {
  it('detects missed calls intent', () => {
    const result = classifyIntent("Show today's missed calls");
    expect(result.intent).toBe('search_calls');
    expect(result.filters.status).toBe('missed');
    expect(result.filters.today).toBe(true);
  });

  it('detects unread messages intent', () => {
    const result = classifyIntent('Show unread SMS');
    expect(result.intent).toBe('search_messages');
    expect(result.filters.unreadOnly).toBe(true);
  });

  it('detects daily summary intent', () => {
    const result = classifyIntent("Summarize today's activity");
    expect(result.intent).toBe('daily_summary');
  });

  it('extracts invoice search terms', () => {
    expect(extractSearchTerms('Search invoice 2048')).toBe('2048');
  });

  it('detects conversation search', () => {
    const result = classifyIntent('Show all conversations about pricing');
    expect(result.intent).toBe('conversation_search');
  });
});

describe('assistant response parsing', () => {
  it('parses structured JSON responses', () => {
    const parsed = parseAssistantResponse(
      JSON.stringify({
        summary: 'Two missed calls today.',
        insights: ['Customer waiting'],
        suggestedActions: ['Call back'],
        followUps: ['Invoice follow-up'],
      }),
    );
    expect(parsed.summary).toContain('missed calls');
    expect(parsed.insights).toHaveLength(1);
  });

  it('normalizes response with search results', () => {
    const normalized = normalizeAssistantResponse(
      { summary: 'Done', insights: [], suggestedActions: [], followUps: [] },
      {
        intent: 'search_calls',
        searchData: { results: [{ type: 'call', id: '1', title: 'Call', subtitle: 'Missed' }], sources: ['callLog'] },
        provider: 'gemini',
        model: 'gemini-2.5-flash',
      },
    );
    expect(normalized.results).toHaveLength(1);
    expect(normalized.intent).toBe('search_calls');
  });
});

describe('context builder security', () => {
  it('redacts secrets in context payload', () => {
    const context = buildAssistantContext({
      question: 'test',
      intent: 'general_search',
      searchData: {
        results: [
          {
            type: 'message',
            id: '1',
            title: 'Auth',
            subtitle: 'Authorization: Bearer secret-token',
          },
        ],
      },
    });
    expect(context).not.toContain('secret-token');
  });
});

describe('query cache', () => {
  beforeEach(() => {
    resetQueryCacheForTests();
  });

  it('caches and returns recent queries', () => {
    const value = { summary: 'cached' };
    setCachedResponse('tenant-1', 'hello', value);
    expect(getCachedResponse('tenant-1', 'hello')).toEqual(value);
    expect(getCachedResponse('tenant-1', 'other')).toBeNull();
  });
});

describe('search integration', () => {
  it('executes missed calls search plan', async () => {
    const { executeSearchPlan } = require('../../lib/ai/assistant/searchService');
    const prisma = {
      callLog: {
        findMany: async () => [
          { id: 'c1', from: '+1', to: '+2', direction: 'inbound', status: 'missed', durationSeconds: 0, createdAt: new Date() },
        ],
      },
    };
    const data = await executeSearchPlan(prisma, 'tenant-1', 'search_calls', { status: 'missed', today: true });
    expect(data.results).toHaveLength(1);
    expect(data.results[0].type).toBe('call');
  });
});

describe('suggested prompts', () => {
  it('returns default prompt list', () => {
    expect(getSuggestedPrompts().length).toBeGreaterThan(3);
  });
});
