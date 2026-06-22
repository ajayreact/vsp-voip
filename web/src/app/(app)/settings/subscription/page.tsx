'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, Phone } from 'lucide-react';
import { SettingsNav } from '@/components/settings-nav';
import { DataTable } from '@/components/data-table';
import { getMe, getTenantSubscription, isUnauthorizedError, type TenantSubscriptionSummary } from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

function subscriptionStatusLabel(summary: TenantSubscriptionSummary) {
  if (summary.stripeSubscription?.status === 'active') return 'Active — card billing';
  if (summary.stripeSubscription?.status === 'past_due') return 'Past due — payment failed';
  if (summary.hasStripeSubscription) return `Stripe: ${summary.stripeSubscription?.status || 'linked'}`;
  if (summary.numberCount > 0) return 'Manual / bank billing';
  return 'No active subscription';
}

export default function SubscriptionSettingsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | undefined>();
  const [summary, setSummary] = useState<TenantSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        return getTenantSubscription();
      })
      .then((res) => {
        if (res?.summary) setSummary(res.summary);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load subscription');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading subscription…
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Subscription unavailable</p>
        <p className="mt-2 text-sm text-slate-400">{error || 'Could not load data'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Settings</h2>
        <p className="text-sm text-slate-400">Recurring billing and active numbers</p>
      </div>

      <SettingsNav role={role} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="panel-card p-5">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CreditCard className="h-4 w-4" />
            Billing status
          </div>
          <p className="mt-2 text-lg font-semibold text-slate-900">{subscriptionStatusLabel(summary)}</p>
          {summary.stripeSubscription?.currentPeriodEnd ? (
            <p className="mt-2 text-xs text-slate-500">
              Current period ends{' '}
              {new Date(summary.stripeSubscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          ) : null}
        </div>
        <div className="panel-card p-5">
          <p className="text-sm text-slate-500">Est. monthly total</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatPrice(summary.estimatedMonthlyTotal)}
          </p>
          <p className="mt-2 text-xs text-slate-500">{summary.numberCount} active number(s)</p>
        </div>
      </div>

      {!summary.stripeEnabled && summary.manualPaymentEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900/90">
          Your organization uses bank transfer invoicing. Recurring fees are billed manually or per
          agreed terms — not via Stripe auto-pay.
        </div>
      ) : null}

      {summary.stripeEnabled && !summary.hasStripeSubscription && summary.numberCount === 0 ? (
        <div className="panel-card p-4 text-sm text-slate-400">
          Card checkout is available. Buy numbers from{' '}
          <Link href="/numbers" className="text-indigo-600 hover:text-indigo-500">
            Buy Numbers
          </Link>{' '}
          to start a Stripe subscription.
        </div>
      ) : null}

      <DataTable
        title="Numbers on recurring billing"
        data={summary.activeNumbers}
        getRowId={(n) => n.id}
        emptyMessage="No numbers on recurring billing yet."
        columns={[
          {
            key: 'number',
            header: 'Number',
            sortable: true,
            render: (n) => (
              <span className="inline-flex items-center gap-2 text-slate-900">
                <Phone className="h-4 w-4 text-indigo-400" />
                {n.number}
              </span>
            ),
          },
          {
            key: 'tenantMonthlyTotal',
            header: 'Monthly',
            sortable: true,
            sortValue: (n) => n.tenantMonthlyTotal ?? n.platformMonthly ?? 0,
            render: (n) => formatPrice(n.tenantMonthlyTotal ?? n.platformMonthly ?? 0),
          },
          {
            key: 'hasStripeBilling',
            header: 'Billing',
            sortable: true,
            sortValue: (n) => (n.hasStripeBilling ? 'stripe' : 'manual'),
            render: (n) => (n.hasStripeBilling ? 'Stripe subscription' : 'Manual / included'),
          },
        ]}
      />

      <p className="text-xs text-slate-500">
        Order history and one-time charges are under{' '}
        <Link href="/settings" className="text-indigo-600 hover:text-indigo-500">
          Billing & orders
        </Link>
        .
      </p>
    </div>
  );
}
