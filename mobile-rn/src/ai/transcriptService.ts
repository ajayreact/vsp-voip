import { authorizedRequest } from '../auth/authService';
import { endpoints } from '../api/endpoints';
import type {
  AiTranscriptEntityType,
  AiTranscriptGenerateResponse,
  AiTranscriptResponse,
} from './transcriptTypes';

function transcriptPath(entityType: AiTranscriptEntityType, entityId: string) {
  switch (entityType) {
    case 'voicemail':
      return endpoints.ai.voicemailTranscript(entityId);
    case 'call':
      return endpoints.ai.callTranscript(entityId);
    default:
      throw new Error(`Unsupported transcript entity: ${entityType}`);
  }
}

function generatePath(entityType: AiTranscriptEntityType, entityId: string) {
  switch (entityType) {
    case 'voicemail':
      return endpoints.ai.generateVoicemailTranscript(entityId);
    case 'call':
      return endpoints.ai.generateCallTranscript(entityId);
    default:
      throw new Error(`Unsupported transcript entity: ${entityType}`);
  }
}

export async function fetchAiTranscript(
  entityType: AiTranscriptEntityType,
  entityId: string,
): Promise<AiTranscriptResponse> {
  return authorizedRequest<AiTranscriptResponse>(transcriptPath(entityType, entityId));
}

export async function requestAiTranscriptGeneration(
  entityType: AiTranscriptEntityType,
  entityId: string,
): Promise<AiTranscriptGenerateResponse> {
  return authorizedRequest<AiTranscriptGenerateResponse>(generatePath(entityType, entityId), {
    method: 'POST',
    body: JSON.stringify({ async: true }),
  });
}

export function filterTranscriptText(text: string, query: string): boolean {
  if (!query.trim()) return true;
  return text.toLowerCase().includes(query.trim().toLowerCase());
}
