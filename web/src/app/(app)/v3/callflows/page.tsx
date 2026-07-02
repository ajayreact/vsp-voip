'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GitBranch, Loader2, Plus, Trash2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, isUnauthorizedError } from '@/lib/api';
import {
  createV3CallFlow,
  deleteV3CallFlow,
  getV3CallFlows,
  isV3PortalEnabled,
  type CallFlow,
} from '@/lib/v3-api';

export default function V3CallFlowsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState<CallFlow[]>([]);
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await getV3CallFlows();
    setItems(res.items || []);
  }

  useEffect(() => {
    if (!isV3PortalEnabled()) {
      router.replace('/dashboard');
      return;
    }
    getMe()
      .then((user) => {
        if (user.role !== 'TENANT_ADMIN' && user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return load();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onCreate() {
    setCreating(true);
    setError('');
    try {
      const name = `Call Flow ${items.length + 1}`;
      const res = await createV3CallFlow({ name });
      router.push(`/v3/callflows/builder?id=${res.callFlow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Archive this call flow?')) return;
    try {
      await deleteV3CallFlow(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

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
        title="Call Flows"
        description="Design inbound call flows — engine only, no live routing."
        actions={
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            New Flow
          </button>
        }
      />

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">DID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Nodes</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((flow) => (
              <tr key={flow.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <GitBranch className="h-4 w-4 text-slate-400" />
                    {flow.name}
                  </div>
                  <div className="text-xs text-slate-500">v{flow.version}</div>
                </td>
                <td className="px-4 py-3">{flow.did || '—'}</td>
                <td className="px-4 py-3">{flow.status}</td>
                <td className="px-4 py-3">{flow.nodeCount} nodes · {flow.edgeCount} edges</td>
                <td className="px-4 py-3 space-x-3">
                  <Link href={`/v3/callflows/builder?id=${flow.id}`} className="text-indigo-600 hover:underline">Builder</Link>
                  <Link href={`/v3/callflows/simulator?id=${flow.id}`} className="text-indigo-600 hover:underline">Simulate</Link>
                  <button type="button" onClick={() => onDelete(flow.id)} className="text-rose-600 hover:underline">
                    <Trash2 className="inline h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No call flows yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
