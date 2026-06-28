'use client';

import { useMemo, useRef, useEffect, type KeyboardEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { MessageAttachment, PlatformConversation, PlatformMessage } from '@/lib/messaging/types';
import {
  formatMessagingTime,
  formatMessageStatus,
  formatPhoneDisplay,
  groupMessagesWithSeparators,
  isFailedMessageStatus,
  isValidMessagingPeer,
  MAX_ATTACHMENT_BYTES,
  MAX_MMS_ATTACHMENTS,
  MAX_SMS_LENGTH,
  normalizeDirection,
} from '@/lib/messaging/format';
import { AttachmentChip, MessageBlock, PendingAttachmentChip } from '@/components/messaging/message-block';
import { DateSeparator, MessagingStateBanner, ThreadSkeleton } from '@/components/messaging/messaging-states';
import type { MessagingLine } from '@/lib/messaging/types';

type ComposeBarProps = {
  lines: MessagingLine[];
  fromLine: string;
  onFromLineChange: (value: string) => void;
  draft: string;
  onDraftChange: (value: string) => void;
  pendingAttachments: MessageAttachment[];
  onRemoveAttachment: (id: string) => void;
  onAttachFiles: (files: FileList | null) => void;
  onSend: () => void;
  sending: boolean;
  disabled: boolean;
  offline: boolean;
  peerError?: string;
  showPeerField?: boolean;
  peer?: string;
  onPeerChange?: (value: string) => void;
};

export function ComposeBar({
  lines,
  fromLine,
  onFromLineChange,
  draft,
  onDraftChange,
  pendingAttachments,
  onRemoveAttachment,
  onAttachFiles,
  onSend,
  sending,
  disabled,
  offline,
  peerError,
  showPeerField,
  peer = '',
  onPeerChange,
}: ComposeBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!disabled && !sending && !offline) onSend();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-4 space-y-3">
      {offline ? (
        <p className="text-xs text-slate-600" role="status">
          You are offline. Messages will send when connectivity returns.
        </p>
      ) : null}

      {showPeerField ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Recipient mobile number</span>
          <input
            type="tel"
            value={peer}
            onChange={(e) => onPeerChange?.(e.target.value)}
            placeholder="+1 client phone (E.164)"
            aria-invalid={Boolean(peerError)}
            className="w-full rounded-lg input-field text-sm"
          />
          {peerError ? <span className="mt-1 block text-xs text-red-600">{peerError}</span> : null}
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Business line (From)</span>
        <select
          value={fromLine}
          onChange={(e) => onFromLineChange(e.target.value)}
          className="w-full rounded-lg input-field text-sm"
          aria-label="Business line"
        >
          {lines.map((line) => (
            <option key={line.id} value={line.number}>
              {formatPhoneDisplay(line.number)}
            </option>
          ))}
        </select>
      </label>

      {pendingAttachments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {pendingAttachments.map((item) => (
            <PendingAttachmentChip
              key={item.id}
              name={item.fileName || 'Attachment'}
              onRemove={() => onRemoveAttachment(item.id)}
            />
          ))}
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Message</span>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          maxLength={MAX_SMS_LENGTH}
          placeholder="Type your message…"
          aria-label="Message text"
          className="w-full rounded-lg input-field text-sm"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*,video/mp4,audio/*,application/pdf,text/plain"
            onChange={(e) => {
              onAttachFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="filter-btn text-xs"
            disabled={offline || pendingAttachments.length >= MAX_MMS_ATTACHMENTS}
          >
            Attach
          </button>
          <span className="text-xs text-slate-500">
            {draft.length}/{MAX_SMS_LENGTH}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled || sending || offline}
          onClick={onSend}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <p className="text-xs text-slate-500">Press Ctrl+Enter to send</p>
    </div>
  );
}

type ThreadPanelProps = {
  conversation: PlatformConversation | null;
  messages: PlatformMessage[];
  threadLoading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  threadError?: string;
  lines: MessagingLine[];
  fromLine: string;
  draft: string;
  sending: boolean;
  pendingAttachments: MessageAttachment[];
  newPeer: string;
  isNewMessage: boolean;
  offline: boolean;
  onFromLineChange: (value: string) => void;
  onDraftChange: (value: string) => void;
  onNewPeerChange: (value: string) => void;
  onAttachFiles: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  onLoadOlder: () => void;
  onRetryThread?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
};

export function ThreadPanel({
  conversation,
  messages,
  threadLoading,
  loadingOlder,
  hasOlder,
  threadError,
  lines,
  fromLine,
  draft,
  sending,
  pendingAttachments,
  newPeer,
  isNewMessage,
  offline,
  onFromLineChange,
  onDraftChange,
  onNewPeerChange,
  onAttachFiles,
  onRemoveAttachment,
  onSend,
  onLoadOlder,
  onRetryThread,
  onBack,
  showBackButton = false,
}: ThreadPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const previousScrollHeightRef = useRef(0);

  const groupedMessages = useMemo(
    () => groupMessagesWithSeparators(messages),
    [messages],
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || loadingOlder) return;

    if (previousScrollHeightRef.current > 0) {
      const delta = node.scrollHeight - previousScrollHeightRef.current;
      if (delta > 0) node.scrollTop = delta;
      previousScrollHeightRef.current = 0;
      return;
    }

    if (shouldStickToBottomRef.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, threadLoading, loadingOlder]);

  useEffect(() => {
    if (loadingOlder && scrollRef.current) {
      previousScrollHeightRef.current = scrollRef.current.scrollHeight;
    }
  }, [loadingOlder]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    function onScroll() {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 80;
    }

    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const peerLabel = conversation
    ? formatPhoneDisplay(conversation.peer)
    : 'New message';

  const peerError = isNewMessage && newPeer.trim() && !isValidMessagingPeer(newPeer)
    ? 'Enter a valid phone number with at least 10 digits.'
    : '';

  const canSend = Boolean(
    (conversation || (newPeer.trim() && isValidMessagingPeer(newPeer)))
    && fromLine
    && (draft.trim() || pendingAttachments.length),
  );

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden panel-card lg:min-h-[560px]">
      <header className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-start gap-2">
          {showBackButton && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Back to conversations"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{peerLabel}</p>
            {conversation ? (
              <p className="text-xs text-slate-500">
                Business line {formatPhoneDisplay(conversation.line)}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Enter a client mobile number to start</p>
            )}
          </div>
        </div>
      </header>

      {threadError ? (
        <div className="border-b border-slate-200 p-3">
          <MessagingStateBanner message={threadError} onRetry={onRetryThread} />
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label="Message thread"
      >
        {hasOlder ? (
          <div className="text-center">
            <button
              type="button"
              disabled={loadingOlder}
              onClick={onLoadOlder}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        ) : null}

        {threadLoading && !messages.length ? <ThreadSkeleton /> : null}

        {!threadLoading
          ? groupedMessages.map((item) => {
            if (item.type === 'separator') {
              return <DateSeparator key={item.key} label={item.label} />;
            }

            const msg = item.message;
            const direction = normalizeDirection(msg.direction);
            return (
              <div key={item.key}>
                <MessageBlock
                  body={msg.body}
                  direction={direction}
                  timestamp={formatMessagingTime(msg.createdAt)}
                  status={formatMessageStatus(msg.status)}
                  statusFailed={isFailedMessageStatus(msg.status)}
                  readAt={msg.readAt}
                  messageType={msg.messageType}
                  deliveryError={msg.deliveryError}
                />
                {msg.attachments?.map((attachment) => (
                  <AttachmentChip key={attachment.id} attachment={attachment} />
                ))}
              </div>
            );
          })
          : null}

        {!threadLoading && !messages.length && conversation ? (
          <p className="py-12 text-center text-sm text-slate-500">No messages in this thread yet</p>
        ) : null}

        {!threadLoading && isNewMessage && !conversation ? (
          <p className="py-12 text-center text-sm text-slate-500">
            Compose a message below to start a new client conversation.
          </p>
        ) : null}
      </div>

      <ComposeBar
        lines={lines}
        fromLine={fromLine}
        onFromLineChange={onFromLineChange}
        draft={draft}
        onDraftChange={onDraftChange}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={onRemoveAttachment}
        onAttachFiles={onAttachFiles}
        onSend={onSend}
        sending={sending}
        disabled={!canSend}
        offline={offline}
        peerError={peerError}
        showPeerField={isNewMessage}
        peer={newPeer}
        onPeerChange={onNewPeerChange}
      />
    </div>
  );
}

export { MAX_ATTACHMENT_BYTES, MAX_MMS_ATTACHMENTS };
