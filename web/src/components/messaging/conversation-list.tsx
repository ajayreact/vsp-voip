'use client';

import type { PlatformConversation } from '@/lib/messaging/types';
import {
  formatMessagingTime,
  formatPhoneDisplay,
  peerInitials,
} from '@/lib/messaging/format';
import { ConversationListSkeleton, MessagingStateBanner } from '@/components/messaging/messaging-states';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

type ConversationListProps = {
  conversations: PlatformConversation[];
  selectedId: string | null;
  search: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error?: string;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onSelect: (conversation: PlatformConversation) => void;
  onLoadMore: () => void;
  onNewMessage: () => void;
  onRetry?: () => void;
};

export function ConversationListPanel({
  conversations,
  selectedId,
  search,
  loading,
  loadingMore,
  hasMore,
  error,
  totalCount,
  onSearchChange,
  onSelect,
  onLoadMore,
  onNewMessage,
  onRetry,
}: ConversationListProps) {
  const searchActive = search.trim().length > 0;
  const showEmpty = !loading && !error && conversations.length === 0;

  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden panel-card lg:min-h-[560px]">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Conversations</h2>
          <button
            type="button"
            onClick={onNewMessage}
            className="btn-primary px-3 py-1.5 text-xs"
            aria-label="Start new message"
          >
            New
          </button>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      {error ? (
        <div className="border-b border-slate-200 p-3">
          <MessagingStateBanner message={error} onRetry={onRetry} />
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto" role="list" aria-label="Conversation list">
        {loading && !conversations.length ? <ConversationListSkeleton /> : null}

        {showEmpty && searchActive ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            No conversations match your search.
          </p>
        ) : null}

        {showEmpty && !searchActive && totalCount === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">
            No conversations yet. Start a new message to reach a client.
          </p>
        ) : null}

        {conversations.map((conv) => {
          const active = selectedId === conv.id;
          const peerLabel = formatPhoneDisplay(conv.peer);
          return (
            <button
              key={conv.id}
              type="button"
              role="listitem"
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(conv)}
              className={cn(
                'flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition',
                active ? 'bg-indigo-50' : 'hover:bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                  active ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700',
                )}
                aria-hidden="true"
              >
                {peerInitials(peerLabel)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-slate-900">{peerLabel}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatMessagingTime(conv.lastMessageAt || conv.lastMessage?.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  Line {formatPhoneDisplay(conv.line)}
                </span>
                <span className="mt-1 block truncate text-sm text-slate-600">
                  {conv.lastMessagePreview || 'No messages yet'}
                </span>
              </span>
              {conv.unreadCount > 0 ? (
                <span
                  className="mt-1 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white"
                  aria-label={`${conv.unreadCount} unread`}
                >
                  {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                </span>
              ) : null}
            </button>
          );
        })}

        {hasMore ? (
          <div className="p-3">
            <button
              type="button"
              disabled={loadingMore}
              onClick={onLoadMore}
              className="w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load older conversations'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
