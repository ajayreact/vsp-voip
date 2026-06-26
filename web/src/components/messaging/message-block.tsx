'use client';

import type { MessageAttachment } from '@/lib/messaging/types';
import { cn } from '@/lib/utils';

type MessageBlockProps = {
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp?: string;
  status?: string;
  statusFailed?: boolean;
  readAt?: string | null;
  messageType?: string;
  deliveryError?: string | null;
};

export function MessageBlock({
  body,
  direction,
  timestamp,
  status,
  statusFailed,
  readAt,
  messageType,
  deliveryError,
}: MessageBlockProps) {
  const outbound = direction === 'outbound';

  return (
    <article
      className={cn(
        'max-w-[92%] rounded-lg border px-4 py-3',
        outbound
          ? 'ml-auto border-indigo-200 border-l-4 border-l-indigo-500 bg-indigo-50/80'
          : 'mr-auto border-slate-200 border-l-4 border-l-slate-400 bg-white',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {outbound ? 'Sent' : 'Received'}
        {messageType === 'MMS' ? ' · MMS' : null}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{body || '(attachment)'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {timestamp ? <span>{timestamp}</span> : null}
        {outbound && status ? (
          <span className={cn(statusFailed && 'font-medium text-red-600')}>{status}</span>
        ) : null}
        {deliveryError ? (
          <span className="font-medium text-red-600">{deliveryError}</span>
        ) : null}
        {outbound && readAt ? <span className="text-indigo-600">Read</span> : null}
      </div>
    </article>
  );
}

type AttachmentChipProps = {
  attachment: MessageAttachment;
};

export function AttachmentChip({ attachment }: AttachmentChipProps) {
  const isImage = attachment.mimeType?.startsWith('image/');
  const href = attachment.publicUrl;

  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex max-w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50"
    >
      {isImage && href ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={href} alt="" className="h-10 w-10 rounded object-cover" />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded bg-indigo-100 text-indigo-600">
          📎
        </span>
      )}
      <span className="truncate">{attachment.fileName || 'Attachment'}</span>
    </a>
  );
}

type PendingAttachmentProps = {
  name: string;
  onRemove: () => void;
};

export function PendingAttachmentChip({ name, onRemove }: PendingAttachmentProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-800">
      {name}
      <button type="button" onClick={onRemove} className="ml-1 text-indigo-500 hover:text-indigo-800">
        ×
      </button>
    </span>
  );
}
