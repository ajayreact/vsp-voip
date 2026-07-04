'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Upload } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { exportV3Configuration, importV3Configuration } from '@/lib/v3-api';

export default function ImportExportPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [validation, setValidation] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    runV3AdminGuard(router)
      .then(setReady)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Access denied'));
  }, [router]);

  async function onExport(format: 'json' | 'csv' | 'zip') {
    setBusy(format);
    setError('');
    try {
      await exportV3Configuration(format);
      setMessage(`Exported as ${format.toUpperCase()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy('');
    }
  }

  async function onImportFile(file: File, apply: boolean) {
    setBusy(apply ? 'apply' : 'validate');
    setError('');
    setValidation(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await importV3Configuration(payload, apply);
      setValidation(res.validation);
      setMessage(apply ? 'Import applied.' : 'Import validated (dry run).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy('');
    }
  }

  if (!ready && !error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Import / Export" description="JSON, CSV summary, or ZIP package — configuration only." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Export</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['json', 'csv', 'zip'] as const).map((fmt) => (
            <button key={fmt} type="button" disabled={!!busy} onClick={() => onExport(fmt)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium uppercase hover:bg-slate-50 disabled:opacity-60">
              <Download className="h-4 w-4" /> {fmt}
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Import</h3>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">
          <Upload className="h-4 w-4" /> Choose backup.json
          <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file, false);
          }} />
        </label>
        {validation ? <pre className="mt-4 overflow-x-auto rounded bg-slate-50 p-3 text-xs">{JSON.stringify(validation, null, 2)}</pre> : null}
      </section>
    </div>
  );
}
