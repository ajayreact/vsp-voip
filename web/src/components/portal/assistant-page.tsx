'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Loader2, Send, Share2, Sparkles } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  fetchAssistantSuggestions,
  formatAssistantForCopy,
  queryAssistant,
  streamAssistant,
  type AssistantResponse,
} from '@/lib/ai-assistant';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
  loading?: boolean;
  error?: string;
};

export function AssistantPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void fetchAssistantSuggestions().then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  const submit = useCallback(async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true);
    setInput('');

    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-u`, role: 'user', text: trimmed },
      { id: `${Date.now()}-a`, role: 'assistant', text: '', loading: true },
    ]);

    const updateAssistant = (patch: Partial<ChatMessage>) => {
      setMessages((prev) => {
        const next = [...prev];
        const idx = next.length - 1;
        if (idx >= 0 && next[idx].role === 'assistant') next[idx] = { ...next[idx], ...patch };
        return next;
      });
    };

    try {
      let streamed = '';
      await streamAssistant(
        trimmed,
        (chunk) => {
          if (chunk.type === 'delta' && typeof chunk.content === 'string') {
            streamed += chunk.content;
            updateAssistant({ text: streamed, loading: true });
          }
          if (chunk.type === 'done') {
            updateAssistant({
              text: String(chunk.summary || streamed),
              response: chunk as AssistantResponse,
              loading: false,
            });
          }
          if (chunk.type === 'error') {
            updateAssistant({ error: String(chunk.message || 'Assistant error'), loading: false });
          }
        },
        abortRef.current.signal,
      );
    } catch {
      try {
        const response = await queryAssistant(trimmed);
        updateAssistant({ text: response.summary, response, loading: false });
      } catch (err) {
        updateAssistant({
          error: err instanceof Error ? err.message : 'Assistant unavailable',
          loading: false,
        });
      }
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="AI Assistant"
        description="Enterprise search and insights across calls, messages, voicemails, and AI summaries."
      />

      <div className="flex flex-wrap gap-2">
        {suggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void submit(prompt)}
            className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="panel-card flex min-h-[480px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === 'user' ? 'text-right' : ''}>
              {msg.role === 'assistant' ? (
                <div className="mb-1 inline-flex items-center gap-2 text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase">AI</span>
                </div>
              ) : null}
              {msg.loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              ) : null}
              {msg.error ? <p className="text-sm text-red-600">{msg.error}</p> : null}
              {msg.text ? <p className="whitespace-pre-wrap text-sm text-slate-800">{msg.text}</p> : null}
              {msg.response?.results?.length ? (
                <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
                  {msg.response.results.slice(0, 5).map((item) => (
                    <div key={`${item.type}-${item.id}`}>
                      <p className="text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-600">{item.subtitle}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {msg.response ? (
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600"
                    onClick={() => void navigator.clipboard.writeText(formatAssistantForCopy(msg.response!))}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-indigo-600"
                    onClick={() => void navigator.share?.({ text: formatAssistantForCopy(msg.response!) })}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-200 p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about calls, messages, voicemails…"
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm"
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit(input);
            }}
          />
          <button
            type="button"
            disabled={busy || !input.trim()}
            onClick={() => void submit(input)}
            className="rounded-full bg-indigo-600 p-2 text-white disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
