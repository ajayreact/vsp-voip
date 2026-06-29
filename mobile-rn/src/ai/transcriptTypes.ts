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

export type AiTranscriptGenerateResponse = {
  success?: boolean;
  queued?: boolean;
  duplicate?: boolean;
  transcript?: AiTranscriptRecord;
};
