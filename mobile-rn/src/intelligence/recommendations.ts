import { formatPhone } from '../utils/format';
import { isToday, isWithinHours } from './dateUtils';
import type { IntelligenceInput, IntelligenceRecommendation } from './types';

function isMissedCall(status?: string): boolean {
  return (status || '').toLowerCase().includes('miss');
}

function isHighPriority(priority?: string | null): boolean {
  const value = (priority || '').toLowerCase();
  return value === 'high' || value === 'urgent';
}

function peerLabel(value: string): string {
  return formatPhone(value);
}

export function buildRecommendations(input: IntelligenceInput): IntelligenceRecommendation[] {
  const now = input.now ?? new Date();
  const items: IntelligenceRecommendation[] = [];

  for (const call of input.calls) {
    if (!isMissedCall(call.status)) continue;
    if (!isToday(call.createdAt, now) && !isWithinHours(call.createdAt, 48, now)) continue;
    const peer = call.direction === 'inbound' ? call.from : call.to;
    items.push({
      id: `missed-${call.id}`,
      kind: 'missed_customer',
      title: `${peerLabel(peer)} missed your call`,
      subtitle: 'Return the call when you are available',
      priority: isToday(call.createdAt, now) ? 'high' : 'medium',
      createdAt: call.createdAt,
      deepLink: { tab: 'Recent', screen: 'RecentMain', params: { initialFilter: 'missed' } },
    });
  }

  for (const conversation of input.conversations) {
    if ((conversation.unreadCount || 0) <= 0) continue;
    items.push({
      id: `sms-${conversation.id}`,
      kind: 'unanswered_message',
      title: `${peerLabel(conversation.peer)} sent unread messages`,
      subtitle: conversation.lastMessagePreview || 'Open conversation to respond',
      priority: (conversation.unreadCount || 0) > 2 ? 'high' : 'medium',
      createdAt: conversation.lastMessageAt || new Date().toISOString(),
      deepLink: {
        tab: 'Text',
        screen: 'ConversationThread',
        params: {
          conversationId: conversation.id,
          peerLabel: peerLabel(conversation.peer),
          lineLabel: conversation.line,
          peerNumber: conversation.peer,
        },
      },
    });
  }

  for (const vm of input.voicemails) {
    if (vm.isRead) continue;
    const cached = input.cachedSummaries.find(
      (entry) => entry.entityType === 'voicemail' && entry.entityId === vm.id,
    );
    const priority = cached?.response.summary?.result?.priority;
    const isUrgent = isHighPriority(priority);
    items.push({
      id: `vm-${vm.id}`,
      kind: isUrgent ? 'urgent_voicemail' : 'urgent_voicemail',
      title: isUrgent
        ? `Urgent voicemail from ${peerLabel(vm.from)}`
        : `Voicemail from ${peerLabel(vm.from)}`,
      subtitle: cached?.response.summary?.result?.summary?.slice(0, 120) || 'Listen and respond',
      priority: isUrgent ? 'high' : 'medium',
      createdAt: vm.createdAt,
      deepLink: { tab: 'You', screen: 'VoicemailDetail', params: { voicemailId: vm.id } },
    });
  }

  for (const { entityType, entityId, response } of input.cachedSummaries) {
    const result = response.summary?.result;
    if (response.status !== 'completed' || !result) continue;

    if (result.callbackRecommendation) {
      items.push({
        id: `callback-${entityType}-${entityId}`,
        kind: 'callback_waiting',
        title: result.callbackRecommendation.slice(0, 80),
        subtitle: 'Callback recommended from recent communication',
        priority: 'high',
        createdAt: response.summary?.generatedAt || new Date().toISOString(),
        deepLink: entityType === 'call'
          ? { tab: 'Recent' }
          : entityType === 'voicemail'
            ? { tab: 'You', screen: 'VoicemailDetail', params: { voicemailId: entityId } }
            : {
                tab: 'Text',
                screen: 'ConversationThread',
                params: { conversationId: entityId, peerLabel: 'Conversation' },
              },
      });
    }

    if (result.salesOpportunity) {
      items.push({
        id: `sales-${entityType}-${entityId}`,
        kind: 'sales_opportunity',
        title: result.salesOpportunity.slice(0, 80),
        subtitle: 'Sales opportunity identified',
        priority: 'medium',
        createdAt: response.summary?.generatedAt || new Date().toISOString(),
        deepLink: { tab: 'AI', screen: 'AssistantHome', params: { initialQuestion: 'Customers needing follow-up' } },
      });
    }

    for (const task of result.followUpTasks || []) {
      items.push({
        id: `followup-${entityType}-${entityId}-${task.slice(0, 24)}`,
        kind: 'follow_up_reminder',
        title: task.slice(0, 80),
        subtitle: 'Follow-up reminder',
        priority: isHighPriority(result.priority) ? 'high' : 'medium',
        createdAt: response.summary?.generatedAt || new Date().toISOString(),
        deepLink: { tab: 'AI', screen: 'AssistantHome', params: { initialQuestion: 'Customers needing follow-up' } },
      });
    }

    if (isHighPriority(result.priority)) {
      items.push({
        id: `priority-${entityType}-${entityId}`,
        kind: 'priority_customer',
        title: result.summary?.slice(0, 80) || 'High priority customer activity',
        subtitle: `Priority: ${result.priority}`,
        priority: 'high',
        createdAt: response.summary?.generatedAt || new Date().toISOString(),
        deepLink: { tab: 'AI' },
      });
    }
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return items
    .sort((a, b) => {
      const rank = priorityRank[a.priority] - priorityRank[b.priority];
      if (rank !== 0) return rank;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 12);
}
