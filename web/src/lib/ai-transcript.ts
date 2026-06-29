import { apiFetch } from '@/lib/api';

export type AiTranscriptEntityType = 'voicemail' | 'call';

export type AiTranscriptRecord = {
  id?: string;
  status: string;
  transcript?: string | null;
  confidence?: number | null;
  detectedLanguage?: string | null;
  provider?: string | null;
  model?: string | null;
  durationSeconds?: number | null;
  processingTimeMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AiTranscriptResponse = {
  success?: boolean;
  status: string;
  reason?: string;
  transcript?: AiTranscriptRecord | null;
};

function transcriptPath(entityType: AiTranscriptEntityType, entityId: string) {
  return entityType === 'voicemail'
    ? `/api/ai/transcripts/voicemail/${entityId}`
    : `/api/ai/transcripts/call/${entityId}`;
}

function generatePath(entityType: AiTranscriptEntityType, entityId: string) {
  return `${transcriptPath(entityType, entityId)}/generate`;
}

export async function fetchAiTranscript(entityType: AiTranscriptEntityType, entityId: string) {
  return apiFetch<AiTranscriptResponse>(transcriptPath(entityType, entityId));
}

export async function requestAiTranscriptGeneration(entityType: AiTranscriptEntityType, entityId: string) {
  return apiFetch<{ success?: boolean; queued?: boolean; duplicate?: boolean; transcript?: AiTranscriptRecord }>(
    generatePath(entityType, entityId),
    { method: 'POST', body: JSON.stringify({ async: true }) },
  );
}

export function highlightTranscriptSearch(text: string, query: string) {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  if (!lower.includes(needle)) return '';
  return text;
}
