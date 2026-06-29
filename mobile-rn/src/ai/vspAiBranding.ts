import type { AiSummaryEntityType } from './types';

export const VSP_AI_BRANDING = {
  productName: 'VSP Intelligence',
  poweredBy: 'Powered by VSP Intelligence',
  tabTitle: 'Intelligence',
  badgeLabel: 'VSP',
  askPlaceholder: 'Ask VSP about calls, messages, voicemails…',
  searchLabel: 'Ask VSP',
  heroEyebrow: 'Enterprise Intelligence',
  heroTitle: 'VSP Intelligence',
  heroSubtitle: 'Search calls, messages, voicemails, and transcripts across your organization',
  thinking: 'Analyzing…',
  unavailable: 'VSP Intelligence is not available for this organization.',
  streamFailed: 'Unable to reach VSP Intelligence. Please try again.',
  insightsUnavailable: 'VSP Insights are not enabled for this organization.',
  dailyBrief: 'VSP Daily Brief',
  businessInsights: 'VSP Business Insights',
  customerTimeline: 'VSP Customer Timeline',
  recommendedBy: 'Recommended by VSP',
  insightsHeading: 'Insights',
  suggestedActionsHeading: 'Suggested Actions',
  followUpsHeading: 'Follow-ups',
  generateInsight: 'Generate Insight',
  copyInsight: 'Copy Insight',
  noInsightYet: 'No insight generated yet.',
  generatingInsight: 'Generating insight…',
  insightFailed: 'Insight generation failed.',
  transcriptUnavailable: 'Transcripts are not enabled for this organization.',
  noTranscriptYet: 'No transcript yet.',
  generateTranscript: 'Generate Transcript',
  transcribing: 'Transcribing audio…',
  transcriptionFailed: 'Transcription failed.',
} as const;

const PROVIDER_PATTERN =
  /\b(gemini|openai|claude|azure|anthropic|gpt-[\d\w.-]+|o\d-mini|o\d)\b/gi;

export function insightTitleForEntity(entityType: AiSummaryEntityType): string {
  switch (entityType) {
    case 'call':
      return 'VSP Call Insight';
    case 'voicemail':
      return 'VSP Voicemail Insight';
    case 'conversation':
      return 'VSP Message Insight';
    default:
      return 'VSP Insight';
  }
}

export function sanitizeAiUserMessage(message: string): string {
  if (!message) return VSP_AI_BRANDING.unavailable;
  let sanitized = message.replace(PROVIDER_PATTERN, 'VSP Intelligence');
  if (/assistant unavailable/i.test(sanitized)) {
    return VSP_AI_BRANDING.unavailable;
  }
  if (/assistant stream failed/i.test(sanitized)) {
    return VSP_AI_BRANDING.streamFailed;
  }
  return sanitized;
}
