'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  fetchAiSummary,
  formatAiSummaryForCopy,
  requestAiSummaryGeneration,
  type AiSummaryEntityType,
  type AiSummaryResponse,
} from '@/lib/ai-summary';

type AiSummaryCardProps = {
  entityType: AiSummaryEntityType;
  entityId: string | null;
  className?: string;
};

function priorityClass(priority?: string) {
  const value = priority?.toLowerCase() || '';
  if (value === 'high') return 'bg-red-100 text-red-700';
  if (value === 'medium') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

export function AiSummaryCard({ entityType, entityId, className = '' }: AiSummaryCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [data, setData] = useState<AiSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetchAiSummary(entityType, entityId);
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI summary');
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
      await requestAiSummaryGeneration(entityType, entityId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summary generation failed');
    } finally {
      setGenerating(false);
    }
  }, [entityId, entityType, load]);

  const result = data?.summary?.result;
  const status = data?.status || 'unknown';
  const copyText = useMemo(() => formatAiSummaryForCopy(result), [result]);

  const handleCopy = useCallback(async () => {
    if (!copyText) return;
    await navigator.clipboard.writeText(copyText);
  }, [copyText]);

  if (!entityId) return null;

  const isProcessing = generating || status === 'pending' || status === 'processing';
  const isUnavailable = status === 'unavailable';
  const isFailed = status === 'failed' || Boolean(error);
  const isEmpty = status === 'not_generated';

  return (
    <div className={`panel-card p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">AI Summary</h3>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">AI</span>
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
            aria-label="Refresh AI summary"
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
            <p className="text-sm text-slate-500">AI summaries are not enabled for this organization.</p>
          ) : null}

          {isEmpty ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-slate-500">No AI summary yet.</p>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={generating}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Generate Summary
              </button>
            </div>
          ) : null}

          {isProcessing ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating summary…
            </div>
          ) : null}

          {isFailed ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-red-600">
                {data?.summary?.errorMessage || error || 'Summary generation failed.'}
              </p>
              <button
                type="button"
                onClick={() => void handleGenerate()}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : null}

          {result && status === 'completed' ? (
            <>
              <p className="text-sm leading-relaxed text-slate-800">
                {result.executiveSummary || result.conversationSummary || result.summary}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.priority ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityClass(result.priority)}`}>
                    Priority: {result.priority}
                  </span>
                ) : null}
                {result.sentiment ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {result.sentiment}
                  </span>
                ) : null}
              </div>
              {result.actionItems?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Action Items</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                    {result.actionItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.keyPoints?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Key Points</p>
                  <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                    {result.keyPoints.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data?.summary?.generatedAt ? (
                <p className="text-xs text-slate-500">
                  Generated {new Date(data.summary.generatedAt).toLocaleString()}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Summary
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
