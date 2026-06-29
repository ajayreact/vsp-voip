'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, FileText, Loader2, RefreshCw } from 'lucide-react';
import {
  fetchAiTranscript,
  highlightTranscriptSearch,
  requestAiTranscriptGeneration,
  type AiTranscriptEntityType,
  type AiTranscriptResponse,
} from '@/lib/ai-transcript';

type TranscriptCardProps = {
  entityType: AiTranscriptEntityType;
  entityId: string | null;
  className?: string;
};

export function TranscriptCard({ entityType, entityId, className = '' }: TranscriptCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<AiTranscriptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchAiTranscript(entityType, entityId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcript');
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!entityId) return undefined;
    const status = data?.status;
    if (status !== 'pending' && status !== 'processing') return undefined;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [data?.status, entityId, load]);

  const handleGenerate = useCallback(async () => {
    if (!entityId) return;
    setGenerating(true);
    setError('');
    try {
      await requestAiTranscriptGeneration(entityType, entityId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setGenerating(false);
    }
  }, [entityId, entityType, load]);

  const record = data?.transcript;
  const text = record?.transcript || '';
  const visibleText = useMemo(() => highlightTranscriptSearch(text, search), [search, text]);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }, [text]);

  if (!entityId) return null;

  const status = data?.status || 'unknown';
  const isProcessing = generating || status === 'pending' || status === 'processing';
  const isUnavailable = status === 'unavailable';
  const isFailed = status === 'failed' || Boolean(error);
  const isEmpty = status === 'not_generated';

  return (
    <div className={`panel-card p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">Transcript</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Expand or collapse"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => (isEmpty || isFailed || isUnavailable ? void handleGenerate() : void load())}
            disabled={isProcessing}
            className="rounded-lg p-1 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
            aria-label="Refresh transcript"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {loading && !data ? (
            <div className="space-y-2">
              <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-8/12 animate-pulse rounded bg-slate-200" />
            </div>
          ) : null}

          {isUnavailable ? (
            <p className="text-sm text-slate-500">Transcription is not enabled for this organization.</p>
          ) : null}

          {isEmpty ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-slate-500">No transcript yet.</p>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Generate Transcript
              </button>
            </div>
          ) : null}

          {isProcessing ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribing audio…
            </div>
          ) : null}

          {isFailed ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-red-600">{record?.errorMessage || error || 'Transcription failed.'}</p>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : null}

          {text && status === 'completed' ? (
            <>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search transcript"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                {search.trim() ? visibleText || 'No matches in transcript.' : text}
              </p>
              <div className="flex flex-wrap gap-2">
                {record?.detectedLanguage ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {record.detectedLanguage}
                  </span>
                ) : null}
                {record?.confidence != null ? (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {Math.round(record.confidence * 100)}% confidence
                  </span>
                ) : null}
              </div>
              {record?.updatedAt || record?.createdAt ? (
                <p className="text-xs text-slate-500">
                  Generated {new Date(record.updatedAt || record.createdAt || '').toLocaleString()}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Transcript
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
