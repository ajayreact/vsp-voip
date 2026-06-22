'use client';

import { formatPhoneNumber } from '@/lib/phone';
import type { ExtensionPhoneNumberRow } from '@/lib/api';

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: ExtensionPhoneNumberRow[];
  disabled?: boolean;
  id?: string;
  className?: string;
  emptyOptionLabel?: string;
};

function formatDidOptionLabel(number: string, label?: string | null): string {
  const formatted = formatPhoneNumber(number);
  if (label?.trim()) return `${formatted} · ${label.trim()}`;
  return formatted;
}

export function ExtensionPrimaryDidSelect({
  value,
  onChange,
  options,
  disabled,
  id = 'extension-primary-did',
  className = '',
  emptyOptionLabel = 'Select phone number...',
}: Props) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base font-medium shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
        value ? 'text-slate-950' : 'text-slate-500'
      } ${className}`}
    >
      <option value="" className="font-normal text-slate-500">
        {emptyOptionLabel}
      </option>
      {options.map((did) => (
        <option key={did.id} value={did.id} className="font-medium text-slate-950">
          {formatDidOptionLabel(did.number, did.label)}
        </option>
      ))}
    </select>
  );
}

export { formatDidOptionLabel };
