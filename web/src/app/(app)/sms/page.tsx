'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteSmsMessage,
  getSmsConfig,
  getSmsConversations,
  getSmsMessages,
  isUnauthorizedError,
  markSmsConversationRead,
  sendSms,
  type SmsConversation,
  type SmsMessageRecord,
} from '@/lib/api';

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : date.toLocaleDateString();
}

const PENDING_SMS_STATUSES = new Set(['queued', 'sending', 'sent']);

function formatSmsStatus(status: string) {
  const labels: Record<string, string> = {
    queued: 'Queued',
    sending: 'Sending…',
    sent: 'Sent',
    delivered: 'Delivered',
    delivery_failed: 'Delivery failed',
    sending_failed: 'Send failed',
    delivery_unconfirmed: 'Sent (unconfirmed)',
    received: 'Received',
  };
  return labels[status] || status;
}

function isFailedSmsStatus(status: string) {
  return status === 'delivery_failed' || status === 'sending_failed';
}

export default function SmsPage() {
  const threadRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const [webhookReachable, setWebhookReachable] = useState(true);
  const [setupHint, setSetupHint] = useState('');
  const [numbersOnProfile, setNumbersOnProfile] = useState<
    { number: string; onProfile: boolean }[]
  >([]);
  const [numbers, setNumbers] = useState<{ id: string; number: string }[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [conversations, setConversations] = useState<SmsConversation[]>([]);
  const [selected, setSelected] = useState<SmsConversation | null>(null);
  const [messages, setMessages] = useState<SmsMessageRecord[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [sending, setSending] = useState(false);
  const [newPeer, setNewPeer] = useState('');
  const [fromLine, setFromLine] = useState('');

  const loadConversations = useCallback(async () => {
    const res = await getSmsConversations();
    setConversations(res.conversations);
  }, []);

  useEffect(() => {
    async function boot() {
      setLoading(true);
      setError('');
      try {
        const config = await getSmsConfig();
        setConfigured(config.configured);
        setWebhookReachable(config.webhookReachable);
        setSetupHint(config.messagingSetup?.message || '');
        setNumbersOnProfile(
          (config.messagingSetup?.numbersOnProfile || []).map((item) => ({
            number: item.number,
            onProfile: item.onProfile,
          })),
        );
        setNumbers(config.numbers);
        setWebhookUrl(config.smsWebhookUrl);
        setFromLine(config.defaultFrom || config.numbers[0]?.number || '');
        setSelected(null);
        setMessages([]);
        await loadConversations();
      } catch (err) {
        if (!isUnauthorizedError(err)) {
          setError(err instanceof Error ? err.message : 'Could not load SMS inbox');
        }
      } finally {
        setLoading(false);
      }
    }
    boot();
  }, [loadConversations]);

  const openConversation = useCallback(async (conversation: SmsConversation) => {
    setSelected(conversation);
    setFromLine(conversation.line);
    setThreadLoading(true);
    setError('');
    try {
      const res = await getSmsMessages(conversation.peer, conversation.line);
      setMessages(res.messages);
      if (conversation.unreadCount > 0) {
        await markSmsConversationRead(conversation.peer, conversation.line);
        setConversations((prev) =>
          prev.map((item) =>
            item.peer === conversation.peer && item.line === conversation.line
              ? { ...item, unreadCount: 0 }
              : item,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const hasPendingOutbound = messages.some(
    (msg) => msg.direction === 'outbound' && PENDING_SMS_STATUSES.has(msg.status),
  );

  useEffect(() => {
    if (!selected || !hasPendingOutbound) return;

    const timer = window.setInterval(async () => {
      try {
        const res = await getSmsMessages(selected.peer, selected.line);
        setMessages(res.messages);
        await loadConversations();
      } catch {
        // Ignore polling errors; user can refresh manually.
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [selected, hasPendingOutbound, loadConversations]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, threadLoading]);

  async function onSend() {
    const peer = selected?.peer || newPeer.trim();
    const line = fromLine;
    const text = composeText.trim();
    if (!peer || !line || !text) return;

    setSending(true);
    setError('');
    try {
      const res = await sendSms({ from: line, to: peer, text });
      setComposeText('');
      if (selected && selected.peer === peer && selected.line === line) {
        setMessages((prev) => [...prev, res.message]);
      } else {
        const conv: SmsConversation = {
          peer,
          line,
          lastMessage: res.message,
          unreadCount: 0,
        };
        setSelected(conv);
        setMessages([res.message]);
        setNewPeer('');
      }
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  async function onDeleteMessage(id: string) {
    if (!confirm('Delete this message?')) return;
    try {
      await deleteSmsMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function startNewMessage() {
    setSelected(null);
    setMessages([]);
    setNewPeer('');
    setComposeText('');
  }

  if (loading) {
    return <div className="py-24 text-center text-slate-400">Loading SMS inbox…</div>;
  }

  if (!numbers.length) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-slate-900">SMS</h2>
        <p className="text-sm text-slate-400">
          Text your clients from a business number you own — not between your own lines.
        </p>
        <div className="panel-card px-5 py-10 text-center text-slate-500">
          You need at least one business number as the sender (From).{' '}
          <Link href="/my-numbers" className="text-indigo-600 hover:text-indigo-500">
            My Numbers
          </Link>
          {' '}or{' '}
          <Link href="/numbers" className="text-indigo-600 hover:text-indigo-500">
            Buy Numbers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-slate-900">SMS</h2>
          <p className="text-sm text-slate-400">
            Send texts to any client mobile number. Your business line is the sender; their phone is the recipient.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewMessage}
          className="btn-primary px-4 py-2 text-sm"
        >
          New client message
        </button>
      </div>

      {!configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Messaging profile is not configured. Set{' '}
          <code className="text-amber-950">TELNYX_MESSAGING_PROFILE_ID</code> in server .env or Admin → Platform
          settings, assign your numbers to that profile in Telnyx, and set its webhook URL to{' '}
          <code className="break-all text-amber-950">{webhookUrl}</code>
        </div>
      ) : null}

      {configured && !webhookReachable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-medium">Local dev: SMS needs ngrok before Telnyx can update delivery status</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Run <code className="text-amber-950">ngrok http 3000</code> in a terminal
            </li>
            <li>
              Copy the HTTPS URL into <code className="text-amber-950">API_PUBLIC_URL</code> in{' '}
              <code className="text-amber-950">.env</code>
            </li>
            <li>Restart the API — the app will auto-set the Telnyx messaging profile webhook</li>
          </ol>
          <p className="mt-2 text-xs text-amber-800">
            Target webhook path: <code className="text-amber-950">/webhook/sms</code> on your ngrok URL. US SMS
            also requires an approved 10DLC campaign on the sender number in Telnyx.
          </p>
        </div>
      ) : null}

      {configured && webhookReachable && setupHint && !setupHint.includes('configured') ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {setupHint}
        </div>
      ) : null}

      {configured && numbersOnProfile.some((item) => !item.onProfile) ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          Sender number not linked to your Telnyx messaging profile:{' '}
          {numbersOnProfile
            .filter((item) => !item.onProfile)
            .map((item) => item.number)
            .join(', ')}
          . Re-assign it in Telnyx or buy the number again through this portal.
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid min-h-[520px] gap-4 lg:grid-cols-[280px_1fr]">
        <div className="panel-card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-900">Conversations</div>
          <div className="max-h-[480px] overflow-y-auto">
            {conversations.map((conv) => {
              const active = selected?.peer === conv.peer && selected?.line === conv.line;
              return (
                <button
                  key={`${conv.line}|${conv.peer}`}
                  type="button"
                  onClick={() => openConversation(conv)}
                  className={`w-full border-b border-slate-200/60 px-4 py-3 text-left transition ${
                    active ? 'bg-indigo-50' : 'hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{conv.peer}</p>
                    {conv.unreadCount > 0 ? (
                      <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs text-white">
                        {conv.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-slate-500">via {conv.line}</p>
                  <p className="mt-1 truncate text-sm text-slate-400">{conv.lastMessage.body}</p>
                  <p className="mt-1 text-xs text-slate-600">{formatTime(conv.lastMessage.createdAt)}</p>
                </button>
              );
            })}
            {!conversations.length ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No conversations yet</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col panel-card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3">
            {selected ? (
              <div>
                <p className="font-medium text-slate-900">{selected.peer}</p>
                <p className="text-xs text-slate-500">Your line: {selected.line}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                New message — enter a client&apos;s mobile number below
              </p>
            )}
          </div>

          <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 max-h-[360px]">
            {threadLoading ? (
              <p className="text-center text-sm text-slate-500">Loading messages…</p>
            ) : (
              messages.map((msg) => {
                const outbound = msg.direction === 'outbound';
                return (
                  <div
                    key={msg.id}
                    className={`group flex ${outbound ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        outbound
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs opacity-70">
                        <span>{formatTime(msg.createdAt)}</span>
                        {outbound ? (
                          <span className={isFailedSmsStatus(msg.status) ? 'text-red-200' : undefined}>
                            {formatSmsStatus(msg.status)}
                            {msg.deliveryError ? ` — ${msg.deliveryError}` : null}
                            {msg.status === 'queued' && !msg.deliveryError
                              ? ' — waiting on Telnyx/carrier (check 10DLC)'
                              : null}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onDeleteMessage(msg.id)}
                          className="opacity-0 transition group-hover:opacity-100 hover:text-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {!threadLoading && !messages.length && selected ? (
              <p className="text-center text-sm text-slate-500">No messages in this thread yet</p>
            ) : null}
          </div>

          <div className="border-t border-slate-200 p-4 space-y-3">
            {!selected ? (
              <label className="block">
                <span className="mb-1.5 block text-xs text-slate-400">Client mobile number</span>
                <input
                  type="tel"
                  value={newPeer}
                  onChange={(e) => setNewPeer(e.target.value)}
                  placeholder="+1 client phone (E.164)"
                  className="w-full rounded-lg input-field text-sm"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Any US/Canada mobile — not limited to your own numbers.
                </span>
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-400">Your business line (From)</span>
              <select
                value={fromLine}
                onChange={(e) => setFromLine(e.target.value)}
                className="w-full rounded-lg input-field text-sm"
              >
                {numbers.map((n) => (
                  <option key={n.id} value={n.number}>
                    {n.number}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-slate-400">Message</span>
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                rows={3}
                maxLength={1600}
                placeholder="Type your message…"
                className="w-full rounded-lg input-field text-sm"
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{composeText.length}/1600</span>
              <button
                type="button"
                disabled={sending || !composeText.trim() || !(selected?.peer || newPeer.trim()) || !fromLine}
                onClick={onSend}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
