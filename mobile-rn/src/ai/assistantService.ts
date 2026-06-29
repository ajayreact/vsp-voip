import { authorizedRequest } from '../auth/authService';
import { endpoints } from '../api/endpoints';
import { VSP_AI_BRANDING } from './vspAiBranding';

export type AssistantResultItem = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  meta?: Record<string, unknown>;
};

export type AssistantResponse = {
  intent: string;
  summary: string;
  insights: string[];
  results: AssistantResultItem[];
  suggestedActions: string[];
  followUps: string[];
  priority?: string | null;
  sentiment?: string | null;
  sources?: string[];
  stats?: Record<string, number> | null;
  generatedAt: string;
  provider: string;
  model: string;
  cached?: boolean;
};

export type AssistantStreamChunk =
  | { type: 'meta'; intent: string; sources?: string[]; stats?: Record<string, number> | null }
  | { type: 'delta'; content: string }
  | { type: 'done'; summary?: string; results?: AssistantResultItem[]; [key: string]: unknown }
  | { type: 'error'; message: string; code?: string };

export async function fetchAssistantSuggestions(): Promise<string[]> {
  const res = await authorizedRequest<{ success?: boolean; suggestions?: string[] }>(
    endpoints.ai.assistantSuggestions,
  );
  return res.suggestions ?? [];
}

export async function queryAssistant(question: string): Promise<AssistantResponse> {
  const res = await authorizedRequest<{ success?: boolean; response: AssistantResponse }>(
    endpoints.ai.assistantQuery,
    { method: 'POST', body: JSON.stringify({ question }) },
  );
  return res.response;
}

export async function streamAssistant(
  question: string,
  handlers: {
    onChunk: (chunk: AssistantStreamChunk) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const { env } = require('../shared/config/env');
  const { getAccessToken } = require('../auth/tokenStorage');
  const token = await getAccessToken();
  const response = await fetch(`${env.apiBaseUrl}${endpoints.ai.assistantStream}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ question }),
    signal: handlers.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(VSP_AI_BRANDING.streamFailed);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const json = await response.json();
    handlers.onChunk({ type: 'done', ...json.response });
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return;
      try {
        handlers.onChunk(JSON.parse(payload));
      } catch {
        /* ignore malformed chunks */
      }
    }
  }
}

export function formatAssistantForCopy(response: AssistantResponse | null): string {
  if (!response) return '';
  const lines = [VSP_AI_BRANDING.productName, '', response.summary];
  if (response.insights?.length) {
    lines.push('', VSP_AI_BRANDING.insightsHeading, ...response.insights.map((i) => `• ${i}`));
  }
  if (response.suggestedActions?.length) {
    lines.push('', VSP_AI_BRANDING.recommendedBy, ...response.suggestedActions.map((i) => `• ${i}`));
  }
  if (response.followUps?.length) {
    lines.push('', VSP_AI_BRANDING.followUpsHeading, ...response.followUps.map((i) => `• ${i}`));
  }
  lines.push('', VSP_AI_BRANDING.poweredBy);
  return lines.join('\n').trim();
}

