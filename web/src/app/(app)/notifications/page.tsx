'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Notifications, type V3Notification } from '@/lib/v3-api';

const SEVERITY_CLASS: Record<string, string> = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-slate-200 bg-slate-50 text-slate-800',
};

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState<V3Notification[]>([]);
  const [summary, setSummary] = useState({ total: 0, errors: 0, warnings: 0 });

  const load = useCallback(async () => {
    const res = await getV3Notifications();
    setNotifications(res.notifications);
    setSummary(res.summary);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load notifications'))
      .finally(() => setLoading(false));
  }, [router, load]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Notification Center"
        description="Configuration-only alerts from health, repair, and license checks — no runtime push notifications."
      />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Total" value={summary.total} />
        <MetricCard label="Errors" value={summary.errors} accent="text-rose-600" />
        <MetricCard label="Warnings" value={summary.warnings} accent="text-amber-600" />
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No alerts at this time.</p>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`rounded-xl border p-4 ${SEVERITY_CLASS[n.severity] || SEVERITY_CLASS.info}`}>
              <div className="flex items-start gap-3">
                {n.severity === 'error' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Bell className="mt-0.5 h-4 w-4 shrink-0" />}
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-1 text-sm opacity-90">{n.message}</p>
                  <p className="mt-2 text-xs uppercase tracking-wide opacity-70">{n.category.replace(/_/g, ' ')} · {n.source}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
