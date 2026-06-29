import { authorizedRequest } from '../auth/authService';
import { endpoints } from '../api/endpoints';
import { insightTitleForEntity, VSP_AI_BRANDING } from './vspAiBranding';
import type {
  AiSummaryEntityType,
  AiSummaryGenerateResponse,
  AiSummaryResponse,
} from './types';

function summaryPath(entityType: AiSummaryEntityType, entityId: string) {
  switch (entityType) {
    case 'voicemail':
      return endpoints.ai.voicemailSummary(entityId);
    case 'call':
      return endpoints.ai.callSummary(entityId);
    case 'conversation':
      return endpoints.ai.conversationSummary(entityId);
    default:
      throw new Error(`Unsupported AI summary entity: ${entityType}`);
  }
}

function generatePath(entityType: AiSummaryEntityType, entityId: string) {
  switch (entityType) {
    case 'voicemail':
      return endpoints.ai.generateVoicemailSummary(entityId);
    case 'call':
      return endpoints.ai.generateCallSummary(entityId);
    case 'conversation':
      return endpoints.ai.generateConversationSummary(entityId);
    default:
      throw new Error(`Unsupported AI summary entity: ${entityType}`);
  }
}

export async function fetchAiSummary(
  entityType: AiSummaryEntityType,
  entityId: string,
): Promise<AiSummaryResponse> {
  return authorizedRequest<AiSummaryResponse>(summaryPath(entityType, entityId));
}

export async function requestAiSummaryGeneration(
  entityType: AiSummaryEntityType,
  entityId: string,
): Promise<AiSummaryGenerateResponse> {
  return authorizedRequest<AiSummaryGenerateResponse>(generatePath(entityType, entityId), {
    method: 'POST',
    body: JSON.stringify({ async: true }),
  });
}

export function formatAiSummaryForCopy(
  result: import('./types').AiSummaryResult | null | undefined,
  entityType?: AiSummaryEntityType,
): string {
  if (!result || typeof result !== 'object') return '';
  const lines: string[] = [];
  if (entityType) {
    lines.push(insightTitleForEntity(entityType));
  }
  if ('summary' in result && result.summary) lines.push(String(result.summary));
  if ('executiveSummary' in result && result.executiveSummary) {
    lines.push('', 'Executive Summary', String(result.executiveSummary));
  }
  if ('conversationSummary' in result && result.conversationSummary) {
    lines.push('', 'Conversation Summary', String(result.conversationSummary));
  }
  if (Array.isArray(result.keyPoints) && result.keyPoints.length) {
    lines.push('', 'Key Points', ...result.keyPoints.map((p) => `• ${p}`));
  }
  if (Array.isArray(result.actionItems) && result.actionItems.length) {
    lines.push('', 'Action Items', ...result.actionItems.map((p) => `• ${p}`));
  }
  if (result.callbackRecommendation) {
    lines.push('', VSP_AI_BRANDING.recommendedBy, String(result.callbackRecommendation));
  }
  if (result.priority) lines.push('', `Priority: ${result.priority}`);
  if (result.sentiment) lines.push(`Sentiment: ${result.sentiment}`);
  lines.push('', VSP_AI_BRANDING.poweredBy);
  return lines.join('\n').trim();
}
