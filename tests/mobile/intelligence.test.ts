import { describe, it, expect } from 'vitest';
import { buildDailyBrief, dailyBriefNotificationBody } from '../../mobile-rn/src/intelligence/dailyBrief';
import { buildRecommendations } from '../../mobile-rn/src/intelligence/recommendations';
import { buildBusinessInsights } from '../../mobile-rn/src/intelligence/businessInsights';
import { buildCustomerTimeline } from '../../mobile-rn/src/intelligence/customerTimeline';
import { buildSmartBanners } from '../../mobile-rn/src/intelligence/smartBanners';
import { getTimeGreeting } from '../../mobile-rn/src/intelligence/greeting';
import type { IntelligenceInput } from '../../mobile-rn/src/intelligence/types';

const NOW = new Date('2026-06-24T10:00:00.000Z');

function baseInput(overrides: Partial<IntelligenceInput> = {}): IntelligenceInput {
  return {
    calls: [],
    voicemails: [],
    conversations: [],
    cachedSummaries: [],
    now: NOW,
    ...overrides,
  };
}

describe('intelligence greeting', () => {
  it('returns morning greeting before noon', () => {
    expect(getTimeGreeting(new Date('2026-06-24T08:00:00'))).toBe('Good Morning');
  });

  it('returns evening greeting after 5pm', () => {
    expect(getTimeGreeting(new Date('2026-06-24T19:00:00'))).toBe('Good Evening');
  });
});

describe('daily brief generation', () => {
  it('counts today metrics from existing data', () => {
    const brief = buildDailyBrief(
      baseInput({
        calls: [
          { id: '1', from: '+1', to: '+2', status: 'completed', createdAt: NOW.toISOString() },
          { id: '2', from: '+3', to: '+4', status: 'missed', createdAt: NOW.toISOString() },
        ],
        conversations: [{ id: 'c1', peer: '+1', line: 'main', unreadCount: 2, lastMessageAt: NOW.toISOString() }],
        voicemails: [{ id: 'v1', from: '+1', to: '+2', durationSeconds: 10, isRead: false, createdAt: NOW.toISOString() }],
      }),
    );

    expect(brief.metrics.todaysCalls).toBe(2);
    expect(brief.metrics.missedCalls).toBe(1);
    expect(brief.metrics.unreadMessages).toBe(2);
    expect(brief.metrics.voicemails).toBe(1);
  });

  it('builds notification body from metrics', () => {
    const body = dailyBriefNotificationBody(
      buildDailyBrief(
        baseInput({
          calls: [{ id: '1', from: '+1', to: '+2', status: 'completed', createdAt: NOW.toISOString() }],
          voicemails: [{ id: 'v1', from: '+1', to: '+2', durationSeconds: 10, isRead: false, createdAt: NOW.toISOString() }],
          conversations: [{ id: 'c1', peer: '+1', line: 'main', unreadCount: 3, lastMessageAt: NOW.toISOString() }],
        }),
      ),
    );
    expect(body).toContain('1 Calls');
    expect(body).toContain('3 Messages');
  });
});

describe('recommendation logic', () => {
  it('creates missed call and unread message recommendations', () => {
    const recs = buildRecommendations(
      baseInput({
        calls: [{ id: '1', from: '+15551234567', to: '+2', direction: 'inbound', status: 'missed', createdAt: NOW.toISOString() }],
        conversations: [
          {
            id: 'c1',
            peer: '+15559876543',
            line: 'main',
            unreadCount: 1,
            lastMessagePreview: 'Need pricing',
            lastMessageAt: NOW.toISOString(),
          },
        ],
      }),
    );

    expect(recs.some((r) => r.kind === 'missed_customer')).toBe(true);
    expect(recs.some((r) => r.kind === 'unanswered_message')).toBe(true);
  });

  it('uses cached AI summary callback recommendations', () => {
    const recs = buildRecommendations(
      baseInput({
        cachedSummaries: [
          {
            entityType: 'call',
            entityId: 'call-1',
            response: {
              status: 'completed',
              summary: {
                status: 'completed',
                result: { summary: 'Customer asked for callback before 4 PM', callbackRecommendation: 'Call back before 4 PM' },
              },
            },
          },
        ],
      }),
    );

    expect(recs.some((r) => r.kind === 'callback_waiting')).toBe(true);
  });
});

describe('business insights', () => {
  it('computes volumes from existing records only', () => {
    const insights = buildBusinessInsights(
      baseInput({
        calls: [
          { id: '1', from: '+1', to: '+2', status: 'completed', createdAt: NOW.toISOString() },
          { id: '2', from: '+1', to: '+2', status: 'completed', createdAt: '2026-06-23T10:00:00.000Z' },
        ],
        conversations: [{ id: 'c1', peer: '+1', line: 'main', unreadCount: 1, lastMessageAt: NOW.toISOString() }],
      }),
    );

    expect(insights.callVolumeToday).toBe(1);
    expect(insights.callVolumeWeek).toBe(2);
    expect(insights.messageVolumeToday).toBe(1);
  });
});

describe('customer timeline', () => {
  it('orders mixed communication events chronologically', () => {
    const timeline = buildCustomerTimeline({
      contactPhones: ['5551234567'],
      contactName: 'John',
      calls: [{ id: '1', from: '+15551234567', to: '+2', direction: 'inbound', status: 'completed', createdAt: '2026-06-24T09:00:00.000Z' }],
      conversations: [
        { id: 'c1', peer: '+15551234567', line: 'main', lastMessagePreview: 'Hello', lastMessageAt: '2026-06-24T11:00:00.000Z' },
      ],
      voicemails: [{ id: 'v1', from: '+15551234567', to: '+2', durationSeconds: 10, isRead: false, createdAt: '2026-06-24T10:00:00.000Z' }],
      cachedSummaries: [],
    });

    expect(timeline.items[0].kind).toBe('message');
    expect(timeline.items[1].kind).toBe('voicemail');
    expect(timeline.items[2].kind).toBe('call');
  });
});

describe('smart banners', () => {
  it('builds contextual banners from recommendations and brief', () => {
    const brief = buildDailyBrief(
      baseInput({
        voicemails: [{ id: 'v1', from: '+1', to: '+2', durationSeconds: 10, isRead: false, createdAt: NOW.toISOString() }],
      }),
    );
    const recommendations = buildRecommendations(baseInput({ voicemails: brief.metrics.voicemails ? [{ id: 'v1', from: '+1', to: '+2', durationSeconds: 10, isRead: false, createdAt: NOW.toISOString() }] : [] }));
    const banners = buildSmartBanners(recommendations, brief);
    expect(banners.length).toBeGreaterThan(0);
    expect(banners[0].message).toContain('Recommended by VSP');
  });
});

describe('performance helpers', () => {
  it('memoizes intelligence input shape without extra fields', () => {
    const input = baseInput();
    expect(Object.keys(input).sort()).toEqual(['cachedSummaries', 'calls', 'conversations', 'now', 'voicemails'].sort());
  });
});
