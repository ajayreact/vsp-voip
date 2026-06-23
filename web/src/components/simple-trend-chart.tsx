'use client';

import { cn } from '@/lib/utils';

type Point = { date: string; value: number };

function shouldShowDateLabel(index: number, total: number) {
  if (total <= 7) return true;
  if (total <= 14) return index % 2 === 0 || index === total - 1;
  const step = Math.max(1, Math.ceil(total / 6));
  return index % step === 0 || index === total - 1;
}

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
  const dense = points.length > 14;

  if (!points.length) {
    return (
      <div className="panel-card p-5">
        <h3 className="mb-4 text-sm font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">No data for this period.</p>
      </div>
    );
  }

  return (
    <div className="panel-card p-5">
      <h3 className="mb-4 text-sm font-medium text-slate-900">{title}</h3>
      <div
        className={cn(
          'flex h-36 items-end gap-0.5',
          dense && 'overflow-x-auto pb-1',
        )}
      >
        {points.map((point, index) => {
          const val = Number(point[key]) || 0;
          const height = `${Math.max(4, Math.round((val / max) * 100))}%`;
          const showLabel = shouldShowDateLabel(index, points.length);

          return (
            <div
              key={`${point.date}-${index}`}
              className={cn(
                'flex flex-col items-center justify-end gap-1',
                dense ? 'w-3 shrink-0' : 'min-w-0 flex-1',
              )}
              title={`${point.date}: ${fmt(val)}`}
            >
              <div
                className={cn('w-full min-h-[3px] rounded-t-md opacity-90', color)}
                style={{ height }}
              />
              {showLabel ? (
                <span className="whitespace-nowrap text-[9px] leading-none text-slate-500">
                  {point.date.slice(5)}
                </span>
              ) : (
                <span className="h-3 shrink-0" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
