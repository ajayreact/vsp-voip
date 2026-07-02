'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { exportV3Report, getV3Reports } from '@/lib/v3-api';

type ReportMeta = { type: string; title: string; rowCount: number };

export default function V3ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [exporting, setExporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Reports();
    setReports(res.reports || []);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router)
      .then((ok) => (ok ? load() : undefined))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, [router, load]);

  async function onExport(type: string, format: 'csv' | 'excel' | 'pdf') {
    setExporting(`${type}-${format}`);
    setError('');
    try {
      await exportV3Report(type, format);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
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
      <PortalPageHeader title="Reports" description="Generate and export tenant reports — CSV, Excel, and PDF." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">Export</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reports.map((report) => (
              <tr key={report.type}>
                <td className="px-4 py-3 font-medium text-slate-900">{report.title}</td>
                <td className="px-4 py-3 text-slate-600">{report.rowCount}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {(['csv', 'excel', 'pdf'] as const).map((format) => (
                      <button
                        key={format}
                        type="button"
                        disabled={exporting === `${report.type}-${format}`}
                        onClick={() => onExport(report.type, format)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium uppercase text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Download className="h-3 w-3" />
                        {format}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
