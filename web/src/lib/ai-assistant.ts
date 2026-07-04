import { apiFetch, getToken, getApiBaseUrl } from '@/lib/api';

export type AssistantResponse = {
  intent: string;
  summary: string;
  insights: string[];
  results: Array<{ type: string; id: string; title: string; subtitle: string; meta?: Record<string, unknown> }>;
  suggestedActions: string[];
  followUps: string[];
  generatedAt: string;
  provider: string;
  model: string;
  cached?: boolean;
};

export async function fetchAssistantSuggestions() {
  const res = await apiFetch<{ suggestions?: string[] }>('/api/ai/assistant/suggestions');
  return res.suggestions ?? [];
}

export async function queryAssistant(question: string) {
  const res = await apiFetch<{ response: AssistantResponse }>('/api/ai/assistant/query', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
  return res.response;
}

export async function streamAssistant(
  question: string,
  onChunk: (chunk: Record<string, unknown>) => void,
  signal?: AbortSignal,
) {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}/api/ai/assistant/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ question }),
    signal,
  });

  if (!response.ok) throw new Error(await response.text());

  const reader = response.body?.getReader();
  if (!reader) {
    const json = await response.json();
    onChunk({ type: 'done', ...json.response });
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
      onChunk(JSON.parse(payload));
    }
  }
}

export function formatAssistantForCopy(response: AssistantResponse | null) {
  if (!response) return '';
  const lines = [response.summary];
  if (response.insights?.length) lines.push('', 'Insights', ...response.insights.map((i) => `• ${i}`));
  if (response.suggestedActions?.length) {
    lines.push('', 'Suggested Actions', ...response.suggestedActions.map((i) => `• ${i}`));
  }
  return lines.join('\n').trim();
}
