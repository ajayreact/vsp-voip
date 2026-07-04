import { formatPhone } from '../utils/format';
import { insightTitleForEntity } from '../ai/vspAiBranding';
import type { CallLogEntry, VoicemailRecord } from '../api/types';
import type { PlatformConversation } from '../messaging/types';
import type { AiSummaryEntityType, AiSummaryResponse } from '../ai/types';
import type { CustomerTimeline, CustomerTimelineItem } from './types';

export type CustomerTimelineInput = {
  contactPhones: string[];
  contactName: string;
  calls: CallLogEntry[];
  conversations: PlatformConversation[];
  voicemails: VoicemailRecord[];
  cachedSummaries: Array<{
    entityType: AiSummaryEntityType;
    entityId: string;
    response: AiSummaryResponse;
  }>;
};

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10);
}

function matchesContact(value: string, phones: string[]): boolean {
  const normalized = normalizePhone(value);
  if (!normalized) return false;
  return phones.some((phone) => normalizePhone(phone) === normalized);
}

function callMatches(call: CallLogEntry, phones: string[]): boolean {
  return matchesContact(call.from, phones) || matchesContact(call.to, phones);
}

function conversationMatches(conversation: PlatformConversation, phones: string[]): boolean {
  return matchesContact(conversation.peer, phones);
}

function voicemailMatches(vm: VoicemailRecord, phones: string[]): boolean {
  return matchesContact(vm.from, phones);
}

export function buildCustomerTimeline(input: CustomerTimelineInput): CustomerTimeline {
  const items: CustomerTimelineItem[] = [];

  for (const call of input.calls.filter((c) => callMatches(c, input.contactPhones))) {
    const peer = call.direction === 'inbound' ? call.from : call.to;
    items.push({
      id: `call-${call.id}`,
      kind: 'call',
      title: `${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call`,
      subtitle: `${formatPhone(peer)} · ${call.status}`,
      timestamp: call.createdAt,
      meta: { callId: call.id },
    });
  }

  for (const conversation of input.conversations.filter((c) => conversationMatches(c, input.contactPhones))) {
    items.push({
      id: `msg-${conversation.id}`,
      kind: 'message',
      title: 'Message thread',
      subtitle: conversation.lastMessagePreview || formatPhone(conversation.peer),
      timestamp: conversation.lastMessageAt || new Date().toISOString(),
      meta: { conversationId: conversation.id, peer: conversation.peer, line: conversation.line },
    });
  }

  for (const vm of input.voicemails.filter((v) => voicemailMatches(v, input.contactPhones))) {
    items.push({
      id: `vm-${vm.id}`,
      kind: 'voicemail',
      title: vm.isRead ? 'Voicemail' : 'New voicemail',
      subtitle: formatPhone(vm.from),
      timestamp: vm.createdAt,
      meta: { voicemailId: vm.id },
    });
  }

  for (const { entityType, entityId, response } of input.cachedSummaries) {
    const result = response.summary?.result;
    if (response.status !== 'completed' || !result) continue;
    const related =
      (entityType === 'call' && input.calls.some((c) => c.id === entityId && callMatches(c, input.contactPhones))) ||
      (entityType === 'conversation' &&
        input.conversations.some((c) => c.id === entityId && conversationMatches(c, input.contactPhones))) ||
      (entityType === 'voicemail' &&
        input.voicemails.some((v) => v.id === entityId && voicemailMatches(v, input.contactPhones)));
    if (!related) continue;

    items.push({
      id: `insight-${entityType}-${entityId}`,
      kind: 'insight',
      title: insightTitleForEntity(entityType),
      subtitle: (result.executiveSummary || result.conversationSummary || result.summary || '').slice(0, 140),
      timestamp: response.summary?.generatedAt || new Date().toISOString(),
      meta: { entityType, entityId },
    });

    for (const task of result.followUpTasks || []) {
      items.push({
        id: `follow-${entityType}-${entityId}-${task.slice(0, 16)}`,
        kind: 'follow_up',
        title: 'Follow-up',
        subtitle: task,
        timestamp: response.summary?.generatedAt || new Date().toISOString(),
      });
    }

    if (result.callbackRecommendation) {
      items.push({
        id: `rec-${entityType}-${entityId}`,
        kind: 'recommendation',
        title: 'Recommended next action',
        subtitle: result.callbackRecommendation,
        timestamp: response.summary?.generatedAt || new Date().toISOString(),
      });
    }
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latestFollowUp = items.find((item) => item.kind === 'follow_up')?.subtitle || null;
  const recommendedNextAction =
    items.find((item) => item.kind === 'recommendation')?.subtitle ||
    items.find((item) => item.kind === 'insight')?.subtitle ||
    null;

  return {
    items: items.slice(0, 30),
    latestFollowUp,
    recommendedNextAction,
  };
}
