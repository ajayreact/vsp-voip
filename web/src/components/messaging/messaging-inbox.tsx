'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isUnauthorizedError } from '@/lib/api';
import {
  fetchConversationMessages,
  fetchConversations,
  fetchMessagingLines,
  markConversationRead,
  sendPlatformMessage,
  uploadMessageAttachment,
} from '@/lib/messaging/client';
import {
  filterConversations,
  isPendingMessageStatus,
} from '@/lib/messaging/format';
import type { MessageAttachment, PlatformConversation, PlatformMessage } from '@/lib/messaging/types';
import { ConversationListPanel } from '@/components/messaging/conversation-list';
import { ThreadPanel } from '@/components/messaging/thread-panel';

const POLL_MS = 8000;
const THREAD_POLL_MS = 5000;

function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

function notifyNewMessage(conversation: PlatformConversation) {
  if (typeof window === 'undefined' || document.visibilityState === 'visible') return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const preview = conversation.lastMessagePreview || 'New message';
  try {
    new Notification('VSP Messages', {
      body: `${conversation.peer}: ${preview}`,
      tag: conversation.id,
    });
  } catch {
    // Ignore notification errors in unsupported contexts.
  }
}

export function MessagingInbox() {
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(true);
  const [webhookReachable, setWebhookReachable] = useState(true);
  const [setupHint, setSetupHint] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [numbersOnProfile, setNumbersOnProfile] = useState<{ number: string; onProfile: boolean }[]>([]);
  const [lines, setLines] = useState<{ id: string; number: string }[]>([]);
  const [fromLine, setFromLine] = useState('');

  const [conversations, setConversations] = useState<PlatformConversation[]>([]);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<PlatformConversation | null>(null);
  const [isNewMessage, setIsNewMessage] = useState(false);
  const [newPeer, setNewPeer] = useState('');
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);

  const unreadSnapshotRef = useRef<Map<string, number>>(new Map());

  const filteredConversations = useMemo(
    () => filterConversations(conversations, search),
    [conversations, search],
  );

  const loadConversations = useCallback(async (cursor?: string | null, append = false) => {
    if (append) setListLoadingMore(true);
    else setListLoading(true);

    try {
      const res = await fetchConversations({ cursor: cursor || undefined, limit: 50 });
      setConversations((prev) => {
        const merged = append ? [...prev, ...res.conversations] : res.conversations;
        const byId = new Map(merged.map((item) => [item.id, item]));
        return Array.from(byId.values());
      });
      setConversationCursor(res.nextCursor);
      setHasMoreConversations(Boolean(res.nextCursor));

      for (const conv of res.conversations) {
        const prevUnread = unreadSnapshotRef.current.get(conv.id) ?? 0;
        if (conv.unreadCount > prevUnread && conv.id !== selected?.id) {
          notifyNewMessage(conv);
        }
        unreadSnapshotRef.current.set(conv.id, conv.unreadCount);
      }
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        setError(err instanceof Error ? err.message : 'Could not load conversations');
      }
    } finally {
      setListLoading(false);
      setListLoadingMore(false);
    }
  }, [selected]);

  const loadThread = useCallback(async (
    conversationId: string,
    cursor?: string | null,
    prepend = false,
  ) => {
    if (prepend) setLoadingOlder(true);
    else setThreadLoading(true);

    try {
      const res = await fetchConversationMessages(conversationId, {
        cursor: cursor || undefined,
        limit: 50,
      });
      setMessages((prev) => {
        const merged = prepend ? [...res.messages, ...prev] : res.messages;
        const byId = new Map(merged.map((item) => [item.id, item]));
        return Array.from(byId.values());
      });
      setMessageCursor(res.nextCursor);
      setHasOlderMessages(Boolean(res.nextCursor));

      if (!prepend) {
        await markConversationRead(conversationId).catch(() => {});
        setConversations((prev) =>
          prev.map((item) =>
            item.id === conversationId ? { ...item, unreadCount: 0 } : item,
          ),
        );
        unreadSnapshotRef.current.set(conversationId, 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load messages');
    } finally {
      setThreadLoading(false);
      setLoadingOlder(false);
    }
  }, []);

  useEffect(() => {
    async function boot() {
      setBootLoading(true);
      setError('');
      try {
        const setup = await fetchMessagingLines();
        setConfigured(setup.configured);
        setWebhookReachable(setup.webhookReachable);
        setSetupHint(setup.setupHint);
        setNumbersOnProfile(setup.numbersOnProfile);
        setWebhookUrl(setup.webhookUrl);
        setLines(setup.lines);
        setFromLine(setup.defaultLine);
        await loadConversations();
        requestNotificationPermission();
      } catch (err) {
        if (!isUnauthorizedError(err)) {
          setError(err instanceof Error ? err.message : 'Could not load messaging');
        }
      } finally {
        setBootLoading(false);
      }
    }
    void boot();
  }, [loadConversations]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadConversations();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  const hasPendingOutbound = messages.some(
    (msg) => String(msg.direction).toUpperCase() === 'OUTBOUND' && isPendingMessageStatus(msg.status),
  );

  useEffect(() => {
    if (!selected?.id) return undefined;
    if (!hasPendingOutbound) return undefined;

    const timer = window.setInterval(() => {
      void loadThread(selected.id);
      void loadConversations();
    }, THREAD_POLL_MS);

    return () => window.clearInterval(timer);
  }, [selected?.id, hasPendingOutbound, loadThread, loadConversations]);

  function openConversation(conversation: PlatformConversation) {
    setSelected(conversation);
    setIsNewMessage(false);
    setNewPeer('');
    setDraft('');
    setPendingAttachments([]);
    setFromLine(conversation.line);
    void loadThread(conversation.id);
  }

  function startNewMessage() {
    setSelected(null);
    setIsNewMessage(true);
    setMessages([]);
    setNewPeer('');
    setDraft('');
    setPendingAttachments([]);
    setMessageCursor(null);
    setHasOlderMessages(false);
  }

  async function onAttachFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    try {
      const uploaded: MessageAttachment[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadMessageAttachment(file));
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attachment upload failed');
    }
  }

  async function onSend() {
    const peer = selected?.peer || newPeer.trim();
    const line = fromLine;
    const text = draft.trim();
    if (!peer || !line || (!text && !pendingAttachments.length)) return;

    setSending(true);
    setError('');
    try {
      const res = await sendPlatformMessage({
        from: line,
        to: peer,
        text,
        attachmentIds: pendingAttachments.map((item) => item.id),
      });
      setDraft('');
      setPendingAttachments([]);

      if (selected?.id === res.message.conversationId) {
        setMessages((prev) => [...prev, res.message]);
      } else {
        await loadConversations();
        const match = conversations.find((c) => c.id === res.message.conversationId);
        if (match) {
          openConversation(match);
        } else {
          const refreshed = await fetchConversations({ limit: 50 });
          const found = refreshed.conversations.find((c) => c.id === res.message.conversationId);
          if (found) {
            openConversation(found);
          } else {
            setIsNewMessage(false);
            setSelected({
              id: res.message.conversationId,
              peer,
              line,
              unreadCount: 0,
            });
            setMessages([res.message]);
          }
        }
      }
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  if (bootLoading) {
    return <div className="py-24 text-center text-slate-400">Loading messages…</div>;
  }

  if (!lines.length) {
    return (
      <div className="space-y-4">
        <h2 className="page-title">Messages</h2>
        <p className="page-subtitle">
          SMS and MMS with your business lines — enterprise messaging for client conversations.
        </p>
        <div className="panel-card px-5 py-10 text-center text-slate-500">
          Assign at least one business number before messaging.{' '}
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
      <div>
        <h2 className="page-title">Messages</h2>
        <p className="page-subtitle">
          Enterprise SMS and MMS — conversation threads tied to your business lines.
        </p>
      </div>

      {!configured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Messaging profile is not configured. Set{' '}
          <code className="text-amber-950">TELNYX_MESSAGING_PROFILE_ID</code> in server .env or Admin → Platform
          settings, and point Telnyx webhooks to{' '}
          <code className="break-all text-amber-950">{webhookUrl}</code>
        </div>
      ) : null}

      {configured && !webhookReachable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Webhook not reachable from Telnyx. For local dev, expose the API via ngrok and set{' '}
          <code className="text-amber-950">API_PUBLIC_URL</code>.
        </div>
      ) : null}

      {configured && setupHint && !setupHint.includes('configured') ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {setupHint}
        </div>
      ) : null}

      {configured && numbersOnProfile.some((item) => !item.onProfile) ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          Sender number not on messaging profile:{' '}
          {numbersOnProfile.filter((item) => !item.onProfile).map((item) => item.number).join(', ')}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[320px_1fr]">
        <ConversationListPanel
          conversations={filteredConversations}
          selectedId={selected?.id || null}
          search={search}
          loading={listLoading}
          loadingMore={listLoadingMore}
          hasMore={hasMoreConversations}
          onSearchChange={setSearch}
          onSelect={openConversation}
          onLoadMore={() => loadConversations(conversationCursor, true)}
          onNewMessage={startNewMessage}
        />

        <ThreadPanel
          conversation={selected}
          messages={messages}
          threadLoading={threadLoading}
          loadingOlder={loadingOlder}
          hasOlder={hasOlderMessages}
          lines={lines}
          fromLine={fromLine}
          draft={draft}
          sending={sending}
          pendingAttachments={pendingAttachments}
          newPeer={newPeer}
          isNewMessage={isNewMessage}
          onFromLineChange={setFromLine}
          onDraftChange={setDraft}
          onNewPeerChange={setNewPeer}
          onAttachFiles={onAttachFiles}
          onRemoveAttachment={(id) =>
            setPendingAttachments((prev) => prev.filter((item) => item.id !== id))
          }
          onSend={() => void onSend()}
          onLoadOlder={() => {
            if (selected?.id && messageCursor) {
              void loadThread(selected.id, messageCursor, true);
            }
          }}
        />
      </div>
    </div>
  );
}
