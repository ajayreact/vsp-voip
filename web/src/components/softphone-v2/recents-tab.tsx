'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  PhoneMissed,
  Search,
} from 'lucide-react';
import type { CallHistoryRecord, RecentsFilter } from '@/components/softphone-v2/types';
import {
  callerInitials,
  formatHistoryTimestamp,
  formatPhoneDisplay,
  historyDirectionLabel,
} from '@/components/softphone-v2/utils';
import { cn } from '@/lib/utils';

type RecentsTabProps = {
  records: CallHistoryRecord[];
  search: string;
  filter: RecentsFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: RecentsFilter) => void;
  onSelect: (record: CallHistoryRecord) => void;
  onInfo: (record: CallHistoryRecord) => void;
  onCallBack: (record: CallHistoryRecord) => void;
};

function DirectionIcon({ record }: { record: CallHistoryRecord }) {
  if (record.status === 'missed') {
    return <PhoneMissed className="h-4 w-4 text-[#FF3B30]" />;
  }
  if (record.direction === 'outbound') {
    return <ArrowUpRight className="h-4 w-4 text-[#8E8E93]" />;
  }
  return <ArrowDownLeft className="h-4 w-4 text-[#8E8E93]" />;
}

export function RecentsTab({
  records,
  search,
  filter,
  onSearchChange,
  onFilterChange,
  onSelect,
  onInfo,
  onCallBack,
}: RecentsTabProps) {
  const query = search.trim().toLowerCase();
  const filtered = records.filter((record) => {
    if (filter === 'missed' && record.status !== 'missed') return false;
    if (!query) return true;
    return (
      record.number.toLowerCase().includes(query)
      || formatPhoneDisplay(record.number).toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pb-3 pt-2">
        <h1 className="text-[34px] font-bold tracking-tight text-[#1D1D1F]">Recents</h1>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="w-full rounded-xl bg-[#E5E5EA]/80 py-2.5 pl-10 pr-4 text-base text-[#1D1D1F] outline-none placeholder:text-[#8E8E93]"
          />
        </div>
        <div className="mt-3 inline-flex rounded-xl bg-[#E5E5EA]/80 p-1">
          {(['all', 'missed'] as RecentsFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onFilterChange(item)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-all',
                filter === item
                  ? 'bg-white text-[#1D1D1F] shadow-sm'
                  : 'text-[#8E8E93]',
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <ul className="flex-1 overflow-y-auto px-2 pb-4">
        {filtered.length === 0 ? (
          <li className="px-4 py-16 text-center text-sm text-[#8E8E93]">No recent calls</li>
        ) : (
          filtered.map((record) => (
            <li
              key={record.id}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-white/70"
            >
              <button
                type="button"
                onClick={() => onSelect(record)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E5E5EA] text-sm font-semibold text-[#636366]">
                  {callerInitials(record.number)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'truncate text-base',
                    record.status === 'missed' ? 'font-semibold text-[#FF3B30]' : 'font-medium text-[#1D1D1F]',
                  )}
                  >
                    {formatPhoneDisplay(record.number)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[#8E8E93]">
                    <DirectionIcon record={record} />
                    <span>{historyDirectionLabel(record.direction)}</span>
                  </p>
                </div>
                <span className="shrink-0 text-sm text-[#8E8E93]">
                  {formatHistoryTimestamp(record.timestamp)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onInfo(record)}
                className="rounded-full p-2 text-[#007AFF] transition-transform hover:scale-105 active:scale-95"
                aria-label="Call details"
              >
                <Info className="h-5 w-5" />
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function RecentsDetailSheet({
  record,
  onClose,
  onCallBack,
}: {
  record: CallHistoryRecord | null;
  onClose: () => void;
  onCallBack: (record: CallHistoryRecord) => void;
}) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-6 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E5EA]" />
        <h2 className="text-2xl font-semibold text-[#1D1D1F]">{formatPhoneDisplay(record.number)}</h2>
        <p className="mt-1 text-sm text-[#8E8E93]">{historyDirectionLabel(record.direction)}</p>
        <p className="mt-1 text-sm text-[#8E8E93]">{formatHistoryTimestamp(record.timestamp)}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => onCallBack(record)}
            className="flex-1 rounded-2xl bg-[#34C759] py-3.5 text-base font-semibold text-white shadow-lg"
          >
            Call Back
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-[#E5E5EA] px-6 py-3.5 text-base font-semibold text-[#1D1D1F]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
