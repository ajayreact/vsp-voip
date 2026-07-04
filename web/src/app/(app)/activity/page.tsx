'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Activity, type ActivityEvent } from '@/lib/v3-api';

const CATEGORIES = ['all', 'employee', 'device', 'number', 'provisioning', 'repair', 'pbx', 'callflow', 'profile', 'report'] as const;

export default function ActivityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<ActivityEvent[]>([]);
  const [category, setCategory] = useState<string>('all');

  const load = useCallback(async (cat: string) => {
    const res = await getV3Activity({
      limit: 100,
      category: cat === 'all' ? undefined : cat,
    });
    setItems(res.items);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load(category) : undefined))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load activity'))
      .finally(() => setLoading(false));
  }, [router, load, category]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Activity Center" description="Tenant timeline from V3 audit events — read-only." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${
              category === cat ? 'bg-slate-900 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No activity recorded yet.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.action}</p>
                </div>
                <time className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {item.actorName || item.actorEmail || 'System'}
                {item.entityType ? ` · ${item.entityType}` : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
