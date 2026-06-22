'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
  id?: string;
  className?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  loading = false,
  disabled = false,
  'aria-label': ariaLabel,
  id,
  className,
}: SwitchProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-busy={loading}
      disabled={isDisabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 select-none rounded-full transition-colors duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'h-7 w-14 md:h-8 md:w-16',
        checked ? 'bg-emerald-500' : 'bg-slate-300',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-between px-1.5 md:px-2"
      >
        <span
          className={cn(
            'text-[9px] font-bold uppercase tracking-wide text-white md:text-[10px]',
            'transition-opacity duration-200',
            checked && !loading ? 'opacity-100' : 'opacity-0',
          )}
        >
          ON
        </span>
        <span
          className={cn(
            'text-[9px] font-bold uppercase tracking-wide text-white md:text-[10px]',
            'transition-opacity duration-200',
            !checked && !loading ? 'opacity-100' : 'opacity-0',
          )}
        >
          OFF
        </span>
      </span>

      <span
        aria-hidden="true"
        className={cn(
          'absolute top-1 left-1 flex items-center justify-center rounded-full bg-white shadow-md',
          'transition-transform duration-200 ease-in-out',
          'h-5 w-5 md:h-6 md:w-6',
          checked ? 'translate-x-7 md:translate-x-8' : 'translate-x-0',
        )}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin text-slate-500 md:h-3.5 md:w-3.5" />
        ) : null}
      </span>
    </button>
  );
}
