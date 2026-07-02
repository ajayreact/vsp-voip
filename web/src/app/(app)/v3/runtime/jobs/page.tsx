'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3RuntimeJobs, retryV3RuntimeJob, type V3RuntimeSyncJob } from '@/lib/v3-api';

export default function V3RuntimeJobsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<V3RuntimeSyncJob[]>([]);

  const load = useCallback(async () => {
    const res = await getV3RuntimeJobs();
    setItems(res.items);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load jobs'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onRetry(id: string) {
    setBusy(id);
    setError('');
    try {
      await retryV3RuntimeJob(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Runtime Sync Jobs" description="Pending, running, and completed synchronization jobs." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Attempts</th>
              <th className="px-4 py-2 font-medium">Error</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">No sync jobs yet.</td></tr>
            ) : items.map((job) => (
              <tr key={job.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{job.entityType} · {job.entityId.slice(0, 8)}</td>
                <td className="px-4 py-2">{job.action}</td>
                <td className="px-4 py-2">{job.status}</td>
                <td className="px-4 py-2">{job.attempts}</td>
                <td className="max-w-xs truncate px-4 py-2 text-rose-600">{job.lastError || '—'}</td>
                <td className="px-4 py-2 text-right">
                  {['FAILED', 'RETRYING', 'DEAD_LETTER'].includes(job.status) ? (
                    <button type="button" disabled={!!busy} onClick={() => onRetry(job.id)} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium">
                      <RotateCcw className="h-3 w-3" /> Retry
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
