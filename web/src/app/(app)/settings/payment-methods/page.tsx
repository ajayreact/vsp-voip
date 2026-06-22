'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { SettingsNav } from '@/components/settings-nav';
import {
  getBillingConfig,
  getMe,
  getTenantSubscription,
  isUnauthorizedError,
  openStripeBillingPortal,
  type BillingConfig,
  type TenantSubscriptionSummary,
} from '@/lib/api';

export default function PaymentMethodsPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | undefined>();
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [summary, setSummary] = useState<TenantSubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        return Promise.all([getBillingConfig(), getTenantSubscription()]);
      })
      .then((res) => {
        if (!res) return;
        const [config, sub] = res;
        setBilling({
          platformFeeSetup: config.platformFeeSetup,
          platformFeeMonthly: config.platformFeeMonthly,
          platformFeeFirstMonth: config.platformFeeFirstMonth,
          currency: config.currency,
          stripeEnabled: config.stripeEnabled,
          manualPaymentEnabled: config.manualPaymentEnabled,
        });
        if (sub?.summary) setSummary(sub.summary);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load payment settings');
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onOpenStripePortal() {
    setOpening(true);
    setError('');
    try {
      const returnUrl = `${window.location.origin}/settings/payment-methods`;
      const res = await openStripeBillingPortal(returnUrl);
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Stripe billing portal');
      setOpening(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading payment methods…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Settings</h2>
        <p className="text-sm text-slate-400">Manage cards, bank billing, and payment methods</p>
      </div>

      <SettingsNav role={role} />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="panel-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CreditCard className="h-4 w-4" />
          Card payments (Stripe)
        </div>

        {billing?.stripeEnabled ? (
          <>
            <p className="text-sm text-slate-600">
              Update saved cards, view Stripe invoices, and manage auto-pay through the secure Stripe customer portal.
            </p>
            {summary?.stripeCustomerConfigured ? (
              <button
                type="button"
                onClick={onOpenStripePortal}
                disabled={opening}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
              >
                {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Manage payment methods
              </button>
            ) : (
              <p className="text-sm text-slate-500">
                Complete a card checkout when buying numbers to create your Stripe customer profile, then return here to manage cards.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">Card payments are not enabled on this platform.</p>
        )}
      </div>

      <div className="panel-card p-6 space-y-3">
        <h3 className="font-medium text-slate-900">Bank transfer</h3>
        {billing?.manualPaymentEnabled ? (
          <p className="text-sm text-slate-600">
            Your organization can pay by bank transfer. Instructions are included on each order invoice under Billing &amp; orders.
          </p>
        ) : (
          <p className="text-sm text-slate-500">Bank transfer invoicing is not configured for your platform.</p>
        )}
      </div>
    </div>
  );
}
