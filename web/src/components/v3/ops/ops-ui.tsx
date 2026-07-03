'use client';

import type { HealthLevel } from '@/lib/v3-api';

export function MetricCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent || 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

const LEVEL_CLASS: Record<HealthLevel, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  red: 'bg-rose-500',
};

export function HealthDot({ level, title }: { level: HealthLevel; title?: string }) {
  return (
    <span title={title} className={`inline-block h-2.5 w-2.5 rounded-full ${LEVEL_CLASS[level]}`} />
  );
}

export function BarChart({ title, data }: { title: string; data: Array<{ label: string; value: number }> }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">No data</p>
      ) : (
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.label} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-sm">
              <span className="truncate text-slate-600" title={item.label}>{item.label}</span>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-slate-800" style={{ width: `${(item.value / max) * 100}%` }} />
              </div>
              <span className="text-right text-slate-700">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LineTrend({ title, data }: { title: string; data: Array<{ label: string; healthScore?: number; employeeCount?: number }> }) {
  const max = Math.max(...data.map((d) => d.healthScore ?? d.employeeCount ?? 0), 1);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="flex h-32 items-end gap-1">
        {data.map((point) => {
          const val = point.healthScore ?? point.employeeCount ?? 0;
          return (
            <div key={point.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-slate-800" style={{ height: `${(val / max) * 100}%`, minHeight: val ? 4 : 0 }} />
              <span className="text-[10px] text-slate-500">{point.label.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function runV3AdminGuard(router: { replace: (path: string) => void }) {
  const { isV3PortalEnabled } = await import('@/lib/v3-api');
  const { getMe, isUnauthorizedError } = await import('@/lib/api');
  if (!isV3PortalEnabled()) {
    router.replace('/dashboard');
    return false;
  }
  try {
    const user = await getMe();
    if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
      return false;
    }
    return true;
  } catch (err) {
    if (isUnauthorizedError(err)) router.replace('/login');
    throw err;
  }
}

export async function runV3SuperAdminGuard(router: { replace: (path: string) => void }) {
  const { isV3PortalEnabled } = await import('@/lib/v3-api');
  const { getMe, isUnauthorizedError } = await import('@/lib/api');
  if (!isV3PortalEnabled()) {
    router.replace('/dashboard');
    return false;
  }
  try {
    const user = await getMe();
    if (user.role !== 'SUPER_ADMIN') {
      router.replace('/dashboard');
      return false;
    }
    return user;
  } catch (err) {
    if (isUnauthorizedError(err)) router.replace('/login');
    throw err;
  }
}
