'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, CreditCard, Landmark, Loader2, Save } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminSectionNav, adminBillingTabs } from '@/components/admin-section-nav';
import { GatewayFeedbackBanner, PaymentGatewayCard } from '@/components/payment-gateway-card';
import { usePaymentGatewayToggle } from '@/hooks/use-payment-gateway-toggle';
import {
  getAdminPaymentGateways,
  getMe,
  isUnauthorizedError,
  updateAdminPaymentGateways,
  type PaymentGatewaySettings,
} from '@/lib/api';

const GATEWAY_LABELS: Record<string, string> = {
  bank: 'Bank Transfer',
  stripe: 'Stripe',
  razorpay: 'Razorpay',
};

export default function AdminPaymentGatewaysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState<PaymentGatewaySettings | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');

  const { feedback, clearFeedback, toggleGateway, isLoading } = usePaymentGatewayToggle(form, setForm);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return getAdminPaymentGateways();
      })
      .then((res) => {
        if (res) setForm(res.settings);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setSaveError(err instanceof Error ? err.message : 'Failed to load settings');
      })
      .finally(() => setLoading(false));
  }, [router]);

  function moveGateway(id: string, direction: -1 | 1) {
    if (!form) return;
    const order = [...form.displayOrder];
    const idx = order.indexOf(id);
    const next = idx + direction;
    if (idx < 0 || next < 0 || next >= order.length) return;
    [order[idx], order[next]] = [order[next], order[idx]];
    setForm({ ...form, displayOrder: order });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaveMessage('');
    setSaveError('');
    try {
      const payload: Parameters<typeof updateAdminPaymentGateways>[0] = { ...form };
      if (razorpayKeyId) payload.razorpayKeyId = razorpayKeyId;
      if (razorpayKeySecret) payload.razorpayKeySecret = razorpayKeySecret;
      const res = await updateAdminPaymentGateways(payload);
      setForm(res.settings);
      setRazorpayKeyId('');
      setRazorpayKeySecret('');
      setSaveMessage('Payment gateway settings saved.');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading payment gateways…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <AdminPageHeader
        section="Billing"
        title="Payment gateways"
        subtitle="Enable checkout methods globally. Bank transfer is the default until Stripe or Razorpay are activated."
      />
      <AdminSectionNav tabs={adminBillingTabs} />

      <GatewayFeedbackBanner feedback={feedback} onDismiss={clearFeedback} />

      {saveMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {saveMessage}
        </div>
      ) : null}
      {saveError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      ) : null}

      <form onSubmit={onSave} className="space-y-6">
        <div className="panel-card p-5 space-y-5">
          <h3 className="font-medium text-slate-900">Checkout display order</h3>
          <p className="text-sm text-slate-500">
            Controls the order payment options appear at checkout (when enabled).
          </p>
          <ul className="space-y-2">
            {form.displayOrder.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span>{GATEWAY_LABELS[id] || id}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveGateway(id, -1)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    aria-label={`Move ${GATEWAY_LABELS[id]} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveGateway(id, 1)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    aria-label={`Move ${GATEWAY_LABELS[id]} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <PaymentGatewayCard
          title="Bank Transfer"
          description="Default payment method when Stripe and Razorpay are off."
          icon={<Landmark className="h-5 w-5" />}
          enabled={form.bankTransferEnabled}
          loading={isLoading('bankTransferEnabled')}
          onEnabledChange={(v) => toggleGateway('bankTransferEnabled', v)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-600">Account name</span>
              <input
                className="mt-1 w-full input-field"
                value={form.bankAccountName}
                onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Bank name</span>
              <input
                className="mt-1 w-full input-field"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Account number</span>
              <input
                className="mt-1 w-full input-field"
                value={form.bankAccountNumber}
                onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">IFSC / SWIFT</span>
              <input
                className="mt-1 w-full input-field"
                value={form.bankIfscSwift}
                onChange={(e) => setForm({ ...form, bankIfscSwift: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">Branch</span>
              <input
                className="mt-1 w-full input-field"
                value={form.bankBranch}
                onChange={(e) => setForm({ ...form, bankBranch: e.target.value })}
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-600">Payment instructions</span>
              <textarea
                className="mt-1 w-full input-field min-h-[80px]"
                value={form.bankPaymentInstructions}
                onChange={(e) => setForm({ ...form, bankPaymentInstructions: e.target.value })}
              />
            </label>
          </div>
        </PaymentGatewayCard>

        <PaymentGatewayCard
          title="Stripe"
          description={
            form.stripeKeysConfigured
              ? 'Card payments via Stripe. Hidden from customers when disabled.'
              : 'Add Stripe keys under Settings → Billing first.'
          }
          icon={<CreditCard className="h-5 w-5" />}
          enabled={form.stripeEnabled}
          mode={form.stripeMode}
          loading={isLoading('stripeEnabled')}
          onEnabledChange={(v) => toggleGateway('stripeEnabled', v)}
        >
          <label className="block text-sm">
            <span className="text-slate-600">Mode</span>
            <select
              className="mt-1 w-full input-field"
              value={form.stripeMode}
              onChange={(e) =>
                setForm({ ...form, stripeMode: e.target.value as 'test' | 'live' })
              }
            >
              <option value="test">Test</option>
              <option value="live">Production</option>
            </select>
          </label>
        </PaymentGatewayCard>

        <PaymentGatewayCard
          title="Razorpay"
          description="Placeholder only — Razorpay appears in admin settings but checkout is not available yet."
          enabled={form.razorpayEnabled}
          mode={form.razorpayMode}
          loading={isLoading('razorpayEnabled')}
          onEnabledChange={(v) => toggleGateway('razorpayEnabled', v)}
        >
          <label className="block text-sm">
            <span className="text-slate-600">Mode</span>
            <select
              className="mt-1 w-full input-field"
              value={form.razorpayMode}
              onChange={(e) =>
                setForm({ ...form, razorpayMode: e.target.value as 'test' | 'live' })
              }
            >
              <option value="test">Test</option>
              <option value="live">Production</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">
              Key ID {form.razorpayConfigured ? `(current: ${form.razorpayKeyIdPreview})` : ''}
            </span>
            <input
              type="password"
              autoComplete="off"
              className="mt-1 w-full input-field"
              placeholder="Leave blank to keep existing"
              value={razorpayKeyId}
              onChange={(e) => setRazorpayKeyId(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Key secret</span>
            <input
              type="password"
              autoComplete="off"
              className="mt-1 w-full input-field"
              placeholder="Leave blank to keep existing"
              value={razorpayKeySecret}
              onChange={(e) => setRazorpayKeySecret(e.target.value)}
            />
          </label>
        </PaymentGatewayCard>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save gateway settings
        </button>
      </form>
    </div>
  );
}
