'use client';

import type { ReactNode } from 'react';
import { Switch } from '@/components/switch';
import { cn } from '@/lib/utils';

export type SwitchFieldProps = {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  loading?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  className?: string;
};

export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  loading,
  disabled,
  trailing,
  className,
}: SwitchFieldProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{label}</p>
          {trailing}
        </div>
        {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        loading={loading}
        disabled={disabled}
        aria-label={`${label} ${checked ? 'on' : 'off'}`}
        className="self-end sm:self-center"
      />
    </div>
  );
}
