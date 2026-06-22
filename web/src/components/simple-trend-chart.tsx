'use client';

type Point = { date: string; value: number };

export function SimpleTrendChart({
  title,
  points,
  valueKey,
  formatValue,
  color = 'bg-indigo-500',
}: {
  title: string;
  points: Point[];
  valueKey?: keyof Point;
  formatValue?: (n: number) => string;
  color?: string;
}) {
  const key = valueKey || ('value' as keyof Point);
  const values = points.map((p) => Number(p[key]) || 0);
  const max = Math.max(1, ...values);
  const fmt = formatValue || ((n: number) => String(n));

  return (
    <div className="panel-card p-5">
      <h3 className="mb-4 text-sm font-medium text-slate-900">{title}</h3>
      <div className="flex h-36 items-end gap-1">
        {points.map((point) => {
          const val = Number(point[key]) || 0;
          const height = `${Math.max(6, Math.round((val / max) * 100))}%`;
          return (
            <div
              key={point.date}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              title={`${point.date}: ${fmt(val)}`}
            >
              <div className={cn('w-full rounded-t-md opacity-90', color)} style={{ height }} />
              <span className="truncate text-[9px] text-slate-500">
                {point.date.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { cn } from '@/lib/utils';
