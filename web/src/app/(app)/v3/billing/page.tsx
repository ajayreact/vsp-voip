'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { MetricCard, runV3AdminGuard } from '@/components/v3/ops/ops-ui';
import { getV3Billing, type V3BillingInvoiceRow, type V3BillingOverview } from '@/lib/v3-api';

export default function V3BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billing, setBilling] = useState<V3BillingOverview | null>(null);

  const load = useCallback(async () => {
    const res = await getV3Billing();
    setBilling(res.billing);
  }, []);

  useEffect(() => {
    runV3AdminGuard(router).then((ok) => (ok ? load() : undefined))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load billing'))
      .finally(() => setLoading(false));
  }, [router, load]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const usage = billing?.usage || {};
  const plan = billing?.plan || {};

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Billing Center" description="Read-only billing overview from existing platform records — no Stripe redesign." />
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricCard label="Plan" value={plan.name || '—'} />
        <MetricCard label="Monthly Est." value={`$${billing?.costs?.estimatedMonthlyTotal ?? '—'}`} />
        <MetricCard label="Seats" value={usage.seats ?? 0} />
        <MetricCard label="Extensions" value={usage.extensions ?? 0} />
        <MetricCard label="Numbers" value={usage.numbers ?? 0} />
        <MetricCard label="Desk Phones" value={usage.deskPhones ?? 0} />
        <MetricCard label="Storage (est.)" value={`${usage.storage?.totalEstimatedMb ?? 0} MB`} />
        <MetricCard label="SMS (30d)" value={usage.smsUsage?.last30Days ?? 0} />
        <MetricCard label="Recordings" value={usage.recordingUsage?.count ?? 0} />
        <MetricCard label="Status" value={plan.billingStatus || '—'} accent={plan.billingStatus === 'ACTIVE' ? 'text-emerald-600' : 'text-amber-600'} />
      </div>
      {billing?.renewalDate ? <p className="text-sm text-slate-600">Renewal: {new Date(billing.renewalDate).toLocaleDateString()}</p> : null}
      <InvoicesTable title="Invoices" rows={billing?.invoices || []} />
      <InvoicesTable title="Pending Receivables" rows={billing?.receivables || []} amountKey="amount" />
    </div>
  );
}

function InvoicesTable({ title, rows, amountKey = 'amount' }: { title: string; rows: V3BillingInvoiceRow[]; amountKey?: string }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b px-4 py-2 text-sm font-medium text-slate-700">{title}</div>
      <table className="min-w-full text-sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-4 py-2">{row.invoiceNumber || row.id.slice(0, 8)}</td>
              <td className="px-4 py-2">{row.status}</td>
              <td className="px-4 py-2">{row[amountKey as keyof V3BillingInvoiceRow] != null ? `$${row[amountKey as keyof V3BillingInvoiceRow]}` : '—'}</td>
              <td className="px-4 py-2 text-slate-500">{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
