'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SlideOverPanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  side?: 'left' | 'right';
  headerExtra?: React.ReactNode;
};

export function SlideOverPanel({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  side = 'right',
  headerExtra,
}: SlideOverPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[100] flex',
        side === 'left' ? 'justify-start' : 'justify-end',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="slide-over-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-label="Close panel"
      />
      <div
        className={cn(
          'relative flex h-full w-full max-w-xl shrink-0 flex-col bg-white shadow-2xl',
          side === 'left' ? 'border-r border-slate-200' : 'border-l border-slate-200',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2 id="slide-over-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {headerExtra ? <div className="mt-2">{headerExtra}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? <div className="border-t border-slate-200 px-6 py-5">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

type IconInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ComponentType<{ className?: string }>;
};

export function IconInput({ icon: Icon, className, type = 'text', ...props }: IconInputProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3.5 py-3',
        'transition focus-within:border-indigo-500 focus-within:ring-[3px] focus-within:ring-indigo-500/15',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <input
        type={type}
        className={cn(
          'min-w-0 flex-1 border-0 bg-transparent p-0 text-[0.9375rem] text-slate-900 outline-none placeholder:text-slate-400',
          type === 'number' &&
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          className,
        )}
        {...props}
      />
    </div>
  );
}
