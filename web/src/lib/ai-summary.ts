import { apiFetch } from '@/lib/api';

export type AiSummaryEntityType = 'voicemail' | 'call' | 'conversation';

export type AiSummaryResult = {
  summary: string;
  keyPoints?: string[];
  actionItems?: string[];
  priority?: string;
  sentiment?: string;
  confidence?: number;
  generatedAt?: string;
  provider?: string;
  model?: string;
  callbackRecommendation?: string;
  executiveSummary?: string;
  discussionTopics?: string[];
  customerIntent?: string;
  followUpTasks?: string[];
  salesOpportunity?: string;
  conversationSummary?: string;
  outstandingQuestions?: string[];
  unreadRequests?: string[];
  latestDecision?: string;
};

export type AiSummaryRecord = {
  id?: string;
  status: string;
  result?: AiSummaryResult | null;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  generatedAt?: string | null;
};

export type AiSummaryResponse = {
  success?: boolean;
  status: string;
  reason?: string;
  summary?: AiSummaryRecord | null;
};

function summaryPath(entityType: AiSummaryEntityType, entityId: string) {
  switch (entityType) {
    case 'voicemail':
      return `/api/ai/summaries/voicemail/${entityId}`;
    case 'call':
      return `/api/ai/summaries/call/${entityId}`;
    case 'conversation':
      return `/api/ai/summaries/conversation/${entityId}`;
    default:
      throw new Error(`Unsupported entity: ${entityType}`);
  }
}

function generatePath(entityType: AiSummaryEntityType, entityId: string) {
  return `${summaryPath(entityType, entityId)}/generate`;
}

export async function fetchAiSummary(entityType: AiSummaryEntityType, entityId: string) {
  return apiFetch<AiSummaryResponse>(summaryPath(entityType, entityId));
}

export async function requestAiSummaryGeneration(entityType: AiSummaryEntityType, entityId: string) {
  return apiFetch<{ success?: boolean; queued?: boolean; summary?: AiSummaryRecord }>(
    generatePath(entityType, entityId),
    { method: 'POST', body: JSON.stringify({ async: true }) },
  );
}

export function formatAiSummaryForCopy(result: AiSummaryResult | null | undefined): string {
  if (!result) return '';
  const lines: string[] = [];
  if (result.summary) lines.push(result.summary);
  if (result.executiveSummary) lines.push('', 'Executive Summary', result.executiveSummary);
  if (result.conversationSummary) lines.push('', 'Conversation Summary', result.conversationSummary);
  if (result.keyPoints?.length) lines.push('', 'Key Points', ...result.keyPoints.map((p) => `• ${p}`));
  if (result.actionItems?.length) lines.push('', 'Action Items', ...result.actionItems.map((p) => `• ${p}`));
  if (result.priority) lines.push('', `Priority: ${result.priority}`);
  if (result.sentiment) lines.push(`Sentiment: ${result.sentiment}`);
  return lines.join('\n').trim();
}
