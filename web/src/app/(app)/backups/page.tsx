'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, RotateCcw } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { createV3Backup, getV3Backups, previewV3Restore, restoreV3Backup, type V3BackupItem } from '@/lib/v3-api';

export default function BackupsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<V3BackupItem[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Backups();
    setItems(res.items);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router).then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load backups'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onCreate() {
    setBusy('create');
    setError('');
    try {
      await createV3Backup(`Backup ${new Date().toLocaleString()}`);
      setMessage('Backup created.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy('');
    }
  }

  async function onPreview(id: string) {
    setBusy(id);
    setPreview(null);
    try {
      const res = await previewV3Restore(id);
      setPreview(res.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy('');
    }
  }

  async function onApply(id: string) {
    if (!confirm('Apply restore? Existing V3 objects will be updated but never silently deleted.')) return;
    setBusy(`apply-${id}`);
    try {
      const res = await restoreV3Backup(id, true);
      setMessage(`Restore applied: ${res.result.applied?.length || 0} changes.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBusy('');
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Backup Center" description="Configuration snapshots — no recordings or media." actions={
        <button type="button" onClick={onCreate} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
          <Plus className="h-4 w-4" /> Create Backup
        </button>
      } />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      <div className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-slate-500">No backups yet.</p> : items.map((b) => (
          <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{b.label}</p>
                <p className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()} · {(b.sizeBytes / 1024).toFixed(1)} KB</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => onPreview(b.id)} disabled={!!busy} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium">Preview</button>
                <button type="button" onClick={() => onApply(b.id)} disabled={!!busy} className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium"><RotateCcw className="h-3 w-3" /> Apply</button>
              </div>
            </div>
            <pre className="mt-2 overflow-x-auto text-xs text-slate-600">{JSON.stringify(b.itemCounts, null, 2)}</pre>
          </div>
        ))}
      </div>
      {preview ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-medium">Restore Preview</p>
          <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(preview, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
