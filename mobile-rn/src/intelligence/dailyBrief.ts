import type { AiSummaryEntityType } from '../ai/types';
import { insightTitleForEntity } from '../ai/vspAiBranding';
import { isToday } from './dateUtils';
import type { DailyBrief, DailyBriefInsight, IntelligenceInput } from './types';

function isMissedCall(status?: string): boolean {
  return (status || '').toLowerCase().includes('miss');
}

function isHighPriority(priority?: string | null): boolean {
  const value = (priority || '').toLowerCase();
  return value === 'high' || value === 'urgent';
}

function countFollowUps(input: IntelligenceInput): number {
  let count = 0;
  for (const { response } of input.cachedSummaries) {
    const result = response.summary?.result;
    if (!result || response.status !== 'completed') continue;
    count += result.followUpTasks?.length ?? 0;
    count += result.actionItems?.length ?? 0;
    if (result.callbackRecommendation) count += 1;
  }
  return count;
}

function countUpcomingCallbacks(input: IntelligenceInput): number {
  let count = 0;
  for (const { response } of input.cachedSummaries) {
    const result = response.summary?.result;
    if (!result?.callbackRecommendation) continue;
    count += 1;
  }
  return count;
}

function buildRecentInsights(input: IntelligenceInput): DailyBriefInsight[] {
  const insights: DailyBriefInsight[] = [];
  for (const { entityType, entityId, response } of input.cachedSummaries) {
    const result = response.summary?.result;
    if (response.status !== 'completed' || !result) continue;
    const summary =
      result.executiveSummary || result.conversationSummary || result.summary || '';
    if (!summary.trim()) continue;
    insights.push({
      id: `${entityType}-${entityId}`,
      entityType,
      entityId,
      title: insightTitleForEntity(entityType),
      summary: summary.slice(0, 180),
      priority: result.priority,
      generatedAt: response.summary?.generatedAt || result.generatedAt || undefined,
    });
  }
  return insights
    .sort((a, b) => {
      const aTime = a.generatedAt ? new Date(a.generatedAt).getTime() : 0;
      const bTime = b.generatedAt ? new Date(b.generatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);
}

export function buildDailyBrief(input: IntelligenceInput): DailyBrief {
  const now = input.now ?? new Date();
  const todaysCalls = input.calls.filter((call) => isToday(call.createdAt, now));
  const missedCalls = todaysCalls.filter((call) => isMissedCall(call.status));
  const unreadMessages = input.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const voicemails = input.voicemails.filter((vm) => !vm.isRead);
  const urgentConversations = input.conversations.filter((c) => (c.unreadCount || 0) > 0).length;

  const highPriorityCustomers = input.cachedSummaries.filter(({ response }) =>
    isHighPriority(response.summary?.result?.priority),
  ).length;

  return {
    metrics: {
      todaysCalls: todaysCalls.length,
      missedCalls: missedCalls.length,
      unreadMessages: input.dashboardStats?.unreadSmsCount ?? unreadMessages,
      voicemails: input.dashboardStats?.unreadVoicemailCount ?? voicemails.length,
      urgentConversations,
      pendingFollowUps: countFollowUps(input),
      highPriorityCustomers,
      upcomingCallbacks: countUpcomingCallbacks(input),
    },
    recentInsights: buildRecentInsights(input),
    generatedAt: now.toISOString(),
  };
}

export function dailyBriefNotificationBody(brief: DailyBrief): string {
  const m = brief.metrics;
  return [
    `${m.todaysCalls} Calls`,
    `${m.voicemails} Voicemails`,
    `${m.unreadMessages} Messages`,
    `${m.pendingFollowUps} Follow-ups`,
  ].join('\n');
}
