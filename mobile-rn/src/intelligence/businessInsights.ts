import { isToday, isThisWeek } from './dateUtils';
import type { BusinessInsights, IntelligenceInput } from './types';

function trend(current: number, previous: number): 'up' | 'down' | 'flat' {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

function averageResponseMinutes(conversations: IntelligenceInput['conversations']): number | null {
  const unread = conversations.filter((c) => (c.unreadCount || 0) > 0 && c.lastMessageAt);
  if (unread.length === 0) return null;
  const now = Date.now();
  const totalMinutes = unread.reduce((sum, c) => {
    const age = now - new Date(c.lastMessageAt!).getTime();
    return sum + age / 60_000;
  }, 0);
  return Math.round(totalMinutes / unread.length);
}

function followUpCompletionRate(input: IntelligenceInput): number | null {
  const summaries = input.cachedSummaries.filter((s) => s.response.status === 'completed');
  if (summaries.length === 0) return null;
  let total = 0;
  let completed = 0;
  for (const { response } of summaries) {
    const tasks = response.summary?.result?.actionItems || [];
    total += tasks.length;
    completed += tasks.filter((task) => /done|complete|resolved/i.test(task)).length;
  }
  if (total === 0) return null;
  return Math.round((completed / total) * 100);
}

export function buildBusinessInsights(input: IntelligenceInput): BusinessInsights {
  const now = input.now ?? new Date();
  const callsToday = input.calls.filter((c) => isToday(c.createdAt, now));
  const callsWeek = input.calls.filter((c) => isThisWeek(c.createdAt, now));
  const callsYesterday = input.calls.filter(
    (c) => isToday(c.createdAt, new Date(now.getTime() - 86_400_000)),
  );

  const messagesToday = input.conversations.filter((c) => c.lastMessageAt && isToday(c.lastMessageAt, now));
  const messagesWeek = input.conversations.filter((c) => c.lastMessageAt && isThisWeek(c.lastMessageAt, now));
  const messagesYesterday = input.conversations.filter(
    (c) => c.lastMessageAt && isToday(c.lastMessageAt, new Date(now.getTime() - 86_400_000)),
  );

  const vmToday = input.voicemails.filter((vm) => isToday(vm.createdAt, now));
  const vmWeek = input.voicemails.filter((vm) => isThisWeek(vm.createdAt, now));
  const vmYesterday = input.voicemails.filter(
    (vm) => isToday(vm.createdAt, new Date(now.getTime() - 86_400_000)),
  );

  const todaysActivity = callsToday.length + messagesToday.length + vmToday.length;
  const weeklyActivity = callsWeek.length + messagesWeek.length + vmWeek.length;

  return {
    todaysActivity,
    weeklyActivity,
    callVolumeToday: callsToday.length,
    callVolumeWeek: callsWeek.length,
    messageVolumeToday: messagesToday.length,
    messageVolumeWeek: messagesWeek.length,
    voicemailVolumeToday: vmToday.length,
    voicemailVolumeWeek: vmWeek.length,
    followUpCompletionRate: followUpCompletionRate(input),
    averageResponseMinutes: averageResponseMinutes(input.conversations),
    trends: {
      calls: trend(callsToday.length, callsYesterday.length),
      messages: trend(messagesToday.length, messagesYesterday.length),
      voicemails: trend(vmToday.length, vmYesterday.length),
    },
  };
}
