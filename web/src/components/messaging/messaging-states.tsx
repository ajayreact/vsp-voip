'use client';

type MessagingStateBannerProps = {
  message: string;
  tone?: 'error' | 'offline' | 'warning';
  onRetry?: () => void;
  onDismiss?: () => void;
};

export function MessagingStateBanner({
  message,
  tone = 'error',
  onRetry,
  onDismiss,
}: MessagingStateBannerProps) {
  const styles = {
    error: 'border-red-200 bg-red-50 text-red-900',
    offline: 'border-slate-300 bg-slate-100 text-slate-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      <span>{message}</span>
      <span className="flex items-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-current px-3 py-1 text-xs font-medium hover:opacity-80"
          >
            Retry
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs font-medium underline hover:opacity-80"
          >
            Dismiss
          </button>
        ) : null}
      </span>
    </div>
  );
}

export function ConversationListSkeleton() {
  return (
    <div className="animate-pulse space-y-0 px-4 py-2" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex gap-3 border-b border-slate-100 py-3">
          <div className="h-10 w-10 rounded-lg bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
            <div className="h-3 w-full rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="animate-pulse space-y-4 px-4 py-6" aria-hidden="true">
      <div className="mr-auto h-16 w-3/4 rounded-lg bg-slate-100" />
      <div className="ml-auto h-12 w-2/3 rounded-lg bg-indigo-100" />
      <div className="mr-auto h-20 w-4/5 rounded-lg bg-slate-100" />
    </div>
  );
}

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
