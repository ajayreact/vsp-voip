import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const toneStyles = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  rose: 'bg-rose-50 text-rose-600 ring-rose-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  tone = 'indigo',
  href,
  badge,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { label: string; positive?: boolean };
  icon: LucideIcon;
  tone?: keyof typeof toneStyles;
  href?: string;
  badge?: string;
}) {
  const content = (
    <div className="panel-card flex h-full flex-col p-5 transition hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl ring-1', toneStyles[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        {badge ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      {trend ? (
        <p
          className={cn(
            'mt-2 text-xs font-medium',
            trend.positive === true && 'text-emerald-600',
            trend.positive === false && 'text-amber-600',
            trend.positive === undefined && 'text-slate-500',
          )}
        >
          {trend.label}
        </p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}

export function KpiSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="section-title">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
