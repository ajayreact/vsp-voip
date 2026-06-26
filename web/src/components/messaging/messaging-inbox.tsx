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
  isValidMessagingPeer,
  mergeMessagesById,
  sortConversationsByActivity,
  MAX_ATTACHMENT_BYTES,
  MAX_MMS_ATTACHMENTS,
} from '@/lib/messaging/format';
import type { MessageAttachment, PlatformConversation, PlatformMessage } from '@/lib/messaging/types';
import { ConversationListPanel } from '@/components/messaging/conversation-list';
import { ThreadPanel } from '@/components/messaging/thread-panel';
import { MessagingStateBanner } from '@/components/messaging/messaging-states';

const POLL_MS = 10000;
const THREAD_POLL_MS = 8000;

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
      body: `${formatPhoneForNotification(conversation.peer)}: ${preview}`,
      tag: conversation.id,
    });
  } catch {
    // Ignore notification errors in unsupported contexts.
  }
}

function formatPhoneForNotification(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return value;
}

function mergeConversationLists(
  previous: PlatformConversation[],
  incoming: PlatformConversation[],
  append: boolean,
) {
  const merged = append ? [...previous, ...incoming] : incoming;
  const byId = new Map(merged.map((item) => [item.id, item]));
  return sortConversationsByActivity(Array.from(byId.values()));
}

export function MessagingInbox() {
  const [bootLoading, setBootLoading] = useState(true);
  const [sendError, setSendError] = useState('');
  const [listError, setListError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [offline, setOffline] = useState(false);
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
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selected?.id || null;
  }, [selected?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  const filteredConversations = useMemo(
    () => filterConversations(conversations, search),
    [conversations, search],
  );

  const loadConversations = useCallback(async (
    cursor?: string | null,
    append = false,
    silent = false,
  ) => {
    if (!silent) {
      if (append) setListLoadingMore(true);
      else setListLoading(true);
    }

    try {
      const res = await fetchConversations({ cursor: cursor || undefined, limit: 50 });
      setConversations((prev) => mergeConversationLists(prev, res.conversations, append));
      setConversationCursor(res.nextCursor);
      setHasMoreConversations(Boolean(res.nextCursor));
      setListError('');

      for (const conv of res.conversations) {
        const prevUnread = unreadSnapshotRef.current.get(conv.id) ?? 0;
        if (conv.unreadCount > prevUnread && conv.id !== selectedIdRef.current) {
          notifyNewMessage(conv);
        }
        unreadSnapshotRef.current.set(conv.id, conv.unreadCount);
      }
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        setListError(err instanceof Error ? err.message : 'Could not load conversations');
      }
    } finally {
      if (!silent) {
        setListLoading(false);
        setListLoadingMore(false);
      }
    }
  }, []);

  const loadThread = useCallback(async (
    conversationId: string,
    cursor?: string | null,
    prepend = false,
    silent = false,
  ) => {
    if (prepend) {
      setLoadingOlder(true);
    } else if (!silent) {
      setThreadLoading(true);
    }

    try {
      const res = await fetchConversationMessages(conversationId, {
        cursor: cursor || undefined,
        limit: 50,
      });

      setMessages((prev) => {
        const merged = prepend
          ? mergeMessagesById([...res.messages, ...prev])
          : mergeMessagesById(res.messages);
        return merged;
      });
      setMessageCursor(res.nextCursor);
      setHasOlderMessages(Boolean(res.nextCursor));
      setThreadError('');

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
      setThreadError(err instanceof Error ? err.message : 'Could not load messages');
    } finally {
      setLoadingOlder(false);
      if (!silent) setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    async function boot() {
      setBootLoading(true);
      setListError('');
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
          setListError(err instanceof Error ? err.message : 'Could not load messaging');
        }
      } finally {
        setBootLoading(false);
      }
    }
    void boot();
  }, [loadConversations]);

  useEffect(() => {
    function tick() {
      if (document.visibilityState !== 'visible') return;
      void loadConversations(null, false, true);
      if (selectedIdRef.current) {
        void loadThread(selectedIdRef.current, null, false, true);
      }
    }

    const timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadConversations, loadThread]);

  const hasPendingOutbound = messages.some(
    (msg) => String(msg.direction).toUpperCase() === 'OUTBOUND' && isPendingMessageStatus(msg.status),
  );

  useEffect(() => {
    if (!selected?.id || !hasPendingOutbound) return undefined;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void loadThread(selected.id, null, false, true);
      void loadConversations(null, false, true);
    }, THREAD_POLL_MS);

    return () => window.clearInterval(timer);
  }, [selected?.id, hasPendingOutbound, loadThread, loadConversations]);

  function openConversation(conversation: PlatformConversation) {
    setSelected(conversation);
    setIsNewMessage(false);
    setNewPeer('');
    setDraft('');
    setPendingAttachments([]);
    setSendError('');
    setThreadError('');
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
    setSendError('');
    setThreadError('');
    setMessageCursor(null);
    setHasOlderMessages(false);
  }

  async function onAttachFiles(files: FileList | null) {
    if (!files?.length) return;
    setSendError('');

    const remaining = MAX_MMS_ATTACHMENTS - pendingAttachments.length;
    if (remaining <= 0) {
      setSendError(`Maximum ${MAX_MMS_ATTACHMENTS} attachments per message.`);
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remaining);
    for (const file of selectedFiles) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setSendError(`"${file.name}" exceeds the 5 MB attachment limit.`);
        return;
      }
    }

    try {
      const uploaded: MessageAttachment[] = [];
      for (const file of selectedFiles) {
        uploaded.push(await uploadMessageAttachment(file));
      }
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Attachment upload failed');
    }
  }

  async function onSend() {
    const peer = selected?.peer || newPeer.trim();
    const line = fromLine;
    const text = draft.trim();

    if (!peer || !line || (!text && !pendingAttachments.length)) return;
    if (!isValidMessagingPeer(peer)) {
      setSendError('Enter a valid recipient phone number.');
      return;
    }
    if (offline) {
      setSendError('You are offline. Reconnect to send messages.');
      return;
    }

    setSending(true);
    setSendError('');
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
        setMessages((prev) => mergeMessagesById([...prev, res.message]));
      } else {
        const refreshed = await fetchConversations({ limit: 50 });
        setConversations(mergeConversationLists([], refreshed.conversations, false));
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
      await loadConversations(null, false, true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  if (bootLoading) {
    return (
      <div className="py-24 text-center text-slate-400" role="status">
        <span className="inline-block animate-pulse">Loading messages…</span>
      </div>
    );
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

      {offline ? (
        <MessagingStateBanner
          tone="offline"
          message="You are offline. Conversation list will refresh when connectivity returns."
        />
      ) : null}

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

      {sendError ? (
        <MessagingStateBanner
          message={sendError}
          onRetry={() => void onSend()}
          onDismiss={() => setSendError('')}
        />
      ) : null}

      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[320px_1fr]">
        <ConversationListPanel
          conversations={filteredConversations}
          selectedId={selected?.id || null}
          search={search}
          loading={listLoading}
          loadingMore={listLoadingMore}
          hasMore={hasMoreConversations}
          error={listError}
          totalCount={conversations.length}
          onSearchChange={setSearch}
          onSelect={openConversation}
          onLoadMore={() => loadConversations(conversationCursor, true)}
          onNewMessage={startNewMessage}
          onRetry={() => loadConversations()}
        />

        <ThreadPanel
          conversation={selected}
          messages={messages}
          threadLoading={threadLoading}
          loadingOlder={loadingOlder}
          hasOlder={hasOlderMessages}
          threadError={threadError}
          lines={lines}
          fromLine={fromLine}
          draft={draft}
          sending={sending}
          pendingAttachments={pendingAttachments}
          newPeer={newPeer}
          isNewMessage={isNewMessage}
          offline={offline}
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
          onRetryThread={() => {
            if (selected?.id) void loadThread(selected.id);
          }}
        />
      </div>
    </div>
  );
}
