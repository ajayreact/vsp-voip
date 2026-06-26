'use client';

import { useRef, useEffect } from 'react';
import type { MessageAttachment, PlatformConversation, PlatformMessage } from '@/lib/messaging/types';
import {
  formatMessagingTime,
  formatMessageStatus,
  formatPhoneDisplay,
  isFailedMessageStatus,
  normalizeDirection,
} from '@/lib/messaging/format';
import { AttachmentChip, MessageBlock, PendingAttachmentChip } from '@/components/messaging/message-block';
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
  showPeerField,
  peer = '',
  onPeerChange,
}: ComposeBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border-t border-slate-200 bg-white p-4 space-y-3">
      {showPeerField ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Recipient mobile number</span>
          <input
            type="tel"
            value={peer}
            onChange={(e) => onPeerChange?.(e.target.value)}
            placeholder="+1 client phone (E.164)"
            className="w-full rounded-lg input-field text-sm"
          />
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Business line (From)</span>
        <select
          value={fromLine}
          onChange={(e) => onFromLineChange(e.target.value)}
          className="w-full rounded-lg input-field text-sm"
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
          rows={3}
          maxLength={1600}
          placeholder="Type your message…"
          className="w-full rounded-lg input-field text-sm"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
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
          >
            Attach
          </button>
          <span className="text-xs text-slate-500">{draft.length}/1600</span>
        </div>
        <button
          type="button"
          disabled={disabled || sending}
          onClick={onSend}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

type ThreadPanelProps = {
  conversation: PlatformConversation | null;
  messages: PlatformMessage[];
  threadLoading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  lines: MessagingLine[];
  fromLine: string;
  draft: string;
  sending: boolean;
  pendingAttachments: MessageAttachment[];
  newPeer: string;
  isNewMessage: boolean;
  onFromLineChange: (value: string) => void;
  onDraftChange: (value: string) => void;
  onNewPeerChange: (value: string) => void;
  onAttachFiles: (files: FileList | null) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: () => void;
  onLoadOlder: () => void;
};

export function ThreadPanel({
  conversation,
  messages,
  threadLoading,
  loadingOlder,
  hasOlder,
  lines,
  fromLine,
  draft,
  sending,
  pendingAttachments,
  newPeer,
  isNewMessage,
  onFromLineChange,
  onDraftChange,
  onNewPeerChange,
  onAttachFiles,
  onRemoveAttachment,
  onSend,
  onLoadOlder,
}: ThreadPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && !loadingOlder) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, threadLoading, loadingOlder]);

  const peerLabel = conversation
    ? formatPhoneDisplay(conversation.peer)
    : 'New message';

  const canSend = Boolean(
    (conversation || newPeer.trim())
    && fromLine
    && (draft.trim() || pendingAttachments.length),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden panel-card">
      <header className="border-b border-slate-200 px-4 py-3">
        <p className="font-semibold text-slate-900">{peerLabel}</p>
        {conversation ? (
          <p className="text-xs text-slate-500">
            Business line {formatPhoneDisplay(conversation.line)}
          </p>
        ) : (
          <p className="text-xs text-slate-500">Enter a client mobile number to start</p>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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

        {threadLoading ? (
          <p className="py-12 text-center text-sm text-slate-500">Loading messages…</p>
        ) : (
          messages.map((msg) => {
            const direction = normalizeDirection(msg.direction);
            return (
              <div key={msg.id}>
                <MessageBlock
                  body={msg.body}
                  direction={direction}
                  timestamp={formatMessagingTime(msg.createdAt)}
                  status={formatMessageStatus(msg.status)}
                  statusFailed={isFailedMessageStatus(msg.status)}
                  readAt={msg.readAt}
                  messageType={msg.messageType}
                />
                {msg.attachments?.map((attachment) => (
                  <AttachmentChip key={attachment.id} attachment={attachment} />
                ))}
              </div>
            );
          })
        )}

        {!threadLoading && !messages.length && conversation ? (
          <p className="py-12 text-center text-sm text-slate-500">No messages in this thread yet</p>
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
        showPeerField={isNewMessage}
        peer={newPeer}
        onPeerChange={onNewPeerChange}
      />
    </div>
  );
}
