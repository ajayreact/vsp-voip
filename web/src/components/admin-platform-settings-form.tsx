'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CreditCard, Loader2, Radio, Save } from 'lucide-react';
import Swal from 'sweetalert2';
import {
  getAdminPaymentGateways,
  getMe,
  getPlatformSettings,
  getTelnyxStatus,
  isUnauthorizedError,
  updatePlatformSettings,
  type PaymentGatewaySettings,
  type PlatformSettings,
  type TelnyxStatus,
} from '@/lib/api';
import { GatewayFeedbackBanner } from '@/components/payment-gateway-card';
import { GatewayStatusBadge, getGatewayStatus } from '@/components/gateway-status-badge';
import { SwitchField } from '@/components/switch-field';
import { usePaymentGatewayToggle } from '@/hooks/use-payment-gateway-toggle';
import { formatPrice } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

export type PlatformSettingsSection = 'stripe' | 'bank' | 'telnyx' | 'markup';

type AdminPlatformSettingsFormProps = {
  sections: PlatformSettingsSection[];
  saveLabel?: string;
};

export function AdminPlatformSettingsForm({
  sections,
  saveLabel = 'Save settings',
}: AdminPlatformSettingsFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [defaultFeeSetup, setDefaultFeeSetup] = useState('0');
  const [defaultFeeFirstMonth, setDefaultFeeFirstMonth] = useState('');
  const [defaultFeeMonthly, setDefaultFeeMonthly] = useState('8');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRoutingNumber, setBankRoutingNumber] = useState('');
  const [bankSwiftCode, setBankSwiftCode] = useState('');
  const [bankPaymentInstructions, setBankPaymentInstructions] = useState('');
  const [invoiceContactEmail, setInvoiceContactEmail] = useState('');
  const [telnyxConnectionId, setTelnyxConnectionId] = useState('');
  const [telnyxConnectionName, setTelnyxConnectionName] = useState('');
  const [telnyxCredentialConnectionId, setTelnyxCredentialConnectionId] = useState('');
  const [telnyxMessagingProfileId, setTelnyxMessagingProfileId] = useState('');
  const [telnyxCallControlApplicationId, setTelnyxCallControlApplicationId] = useState('');
  const [telnyxStatus, setTelnyxStatus] = useState<TelnyxStatus | null>(null);
  const [gatewaySettings, setGatewaySettings] = useState<PaymentGatewaySettings | null>(null);
  const [gatewayLoadError, setGatewayLoadError] = useState('');

  const { feedback, clearFeedback, toggleGateway, isLoading } = usePaymentGatewayToggle(
    gatewaySettings,
    setGatewaySettings,
  );

  const showStripe = sections.includes('stripe');
  const showBank = sections.includes('bank');
  const showGateways = showStripe || showBank;
  const showTelnyx = sections.includes('telnyx');
  const showMarkup = sections.includes('markup');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        const tasks: Promise<unknown>[] = [getPlatformSettings()];
        if (showTelnyx) tasks.push(getTelnyxStatus());
        if (showGateways) tasks.push(getAdminPaymentGateways().catch(() => null));
        return Promise.all(tasks);
      })
      .then((res) => {
        if (!res) return;
        const settingsRes = res[0] as Awaited<ReturnType<typeof getPlatformSettings>>;
        let idx = 1;
        let telnyxRes: Awaited<ReturnType<typeof getTelnyxStatus>> | undefined;
        if (showTelnyx) {
          telnyxRes = res[idx] as Awaited<ReturnType<typeof getTelnyxStatus>>;
          idx += 1;
        }
        const gatewayRes = showGateways
          ? (res[idx] as Awaited<ReturnType<typeof getAdminPaymentGateways>> | null)
          : null;

        if (!settingsRes?.settings) return;
        setSettings(settingsRes.settings);
        setTelnyxStatus(telnyxRes?.status || null);
        setStripePublishableKey(settingsRes.settings.stripePublishableKey || '');
        setDefaultFeeSetup(String(settingsRes.settings.defaultFeeSetup));
        setDefaultFeeMonthly(String(settingsRes.settings.defaultFeeMonthly));
        setDefaultFeeFirstMonth(
          settingsRes.settings.defaultFeeFirstMonth != null
            ? String(settingsRes.settings.defaultFeeFirstMonth)
            : '',
        );
        setBankName(settingsRes.settings.bankName || '');
        setBankAccountName(settingsRes.settings.bankAccountName || '');
        setBankAccountNumber(settingsRes.settings.bankAccountNumber || '');
        setBankRoutingNumber(settingsRes.settings.bankRoutingNumber || '');
        setBankSwiftCode(settingsRes.settings.bankSwiftCode || '');
        setBankPaymentInstructions(settingsRes.settings.bankPaymentInstructions || '');
        setInvoiceContactEmail(settingsRes.settings.invoiceContactEmail || '');
        setTelnyxConnectionId(settingsRes.settings.telnyxConnectionId || '');
        setTelnyxConnectionName(settingsRes.settings.telnyxConnectionName || 'VSP-VOIP Voice App');
        setTelnyxCredentialConnectionId(settingsRes.settings.telnyxCredentialConnectionId || '');
        setTelnyxMessagingProfileId(settingsRes.settings.telnyxMessagingProfileId || '');
        setTelnyxCallControlApplicationId(settingsRes.settings.telnyxCallControlApplicationId || '');
        if (gatewayRes?.settings) {
          setGatewaySettings(gatewayRes.settings);
          setGatewayLoadError('');
        } else if (showGateways) {
          setGatewayLoadError(
            'Could not load gateway toggles from API. Restart the backend (npm start) and refresh.',
          );
        }
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router, showTelnyx, showGateways]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Parameters<typeof updatePlatformSettings>[0] = {};

      if (showStripe) {
        payload.stripePublishableKey = stripePublishableKey;
        if (stripeSecretKey.trim()) payload.stripeSecretKey = stripeSecretKey.trim();
        if (stripeWebhookSecret.trim()) payload.stripeWebhookSecret = stripeWebhookSecret.trim();
      }

      if (showBank) {
        payload.bankName = bankName;
        payload.bankAccountName = bankAccountName;
        payload.bankAccountNumber = bankAccountNumber;
        payload.bankRoutingNumber = bankRoutingNumber;
        payload.bankSwiftCode = bankSwiftCode;
        payload.bankPaymentInstructions = bankPaymentInstructions;
        payload.invoiceContactEmail = invoiceContactEmail;
      }

      if (showTelnyx) {
        payload.telnyxConnectionId = telnyxConnectionId;
        payload.telnyxConnectionName = telnyxConnectionName;
        payload.telnyxCredentialConnectionId = telnyxCredentialConnectionId;
        payload.telnyxMessagingProfileId = telnyxMessagingProfileId;
        payload.telnyxCallControlApplicationId = telnyxCallControlApplicationId;
      }

      if (showMarkup) {
        payload.defaultFeeSetup = Number(defaultFeeSetup) || 0;
        payload.defaultFeeMonthly = Number(defaultFeeMonthly) || 0;
        payload.defaultFeeFirstMonth = defaultFeeFirstMonth === '' ? null : Number(defaultFeeFirstMonth);
      }

      const res = await updatePlatformSettings(payload);
      setSettings(res.settings);
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      if (showTelnyx) {
        const telnyxRes = await getTelnyxStatus();
        setTelnyxStatus(telnyxRes.status);
      }
      await Swal.fire({
        title: 'Settings saved',
        text: 'Platform configuration updated.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not save settings',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {showGateways ? (
        <div className="panel-card p-6 space-y-4">
          <div>
            <h3 className="font-medium text-slate-900">Payment gateways at checkout</h3>
            <p className="mt-1 text-sm text-slate-500">
              Turn each payment method on or off for all customers. Changes save immediately.
            </p>
          </div>
          <GatewayFeedbackBanner feedback={feedback} onDismiss={clearFeedback} />
          {gatewayLoadError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {gatewayLoadError}
            </div>
          ) : null}
          {gatewaySettings ? (
            <div className="space-y-2">
              <SwitchField
                label="Bank Transfer"
                description="Default when Stripe and Razorpay are off."
                checked={gatewaySettings.bankTransferEnabled}
                onCheckedChange={(v) => toggleGateway('bankTransferEnabled', v)}
                loading={isLoading('bankTransferEnabled')}
                trailing={
                  <GatewayStatusBadge
                    status={getGatewayStatus(gatewaySettings.bankTransferEnabled)}
                  />
                }
              />
              <SwitchField
                label="Stripe (card payments)"
                description="Also requires Stripe API keys configured below."
                checked={gatewaySettings.stripeEnabled}
                onCheckedChange={(v) => toggleGateway('stripeEnabled', v)}
                loading={isLoading('stripeEnabled')}
                trailing={
                  <GatewayStatusBadge
                    status={getGatewayStatus(
                      gatewaySettings.stripeEnabled,
                      gatewaySettings.stripeMode,
                    )}
                  />
                }
              />
              <SwitchField
                label="Razorpay"
                description="Placeholder only — not available at checkout yet."
                checked={gatewaySettings.razorpayEnabled}
                onCheckedChange={(v) => toggleGateway('razorpayEnabled', v)}
                loading={isLoading('razorpayEnabled')}
                trailing={
                  <GatewayStatusBadge
                    status={getGatewayStatus(
                      gatewaySettings.razorpayEnabled,
                      gatewaySettings.razorpayMode,
                    )}
                  />
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {showStripe ? (
        <div className="panel-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-400" />
              <h3 className="font-medium text-slate-900">Stripe payments</h3>
            </div>
            {gatewaySettings ? (
              <GatewayStatusBadge
                status={getGatewayStatus(
                  gatewaySettings.stripeEnabled,
                  gatewaySettings.stripeMode,
                )}
              />
            ) : null}
          </div>
          <p className="text-sm text-slate-400">
            Keys from{' '}
            <a
              href="https://dashboard.stripe.com/test/apikeys"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Stripe Dashboard → API keys
            </a>
            . Leave secret fields blank to keep existing values.
          </p>

          <div className="grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Publishable key</span>
              <input
                type="text"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                placeholder="pk_test_..."
                className="w-full rounded-lg input-field font-mono text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Secret key</span>
              {settings?.stripeSecretKeyConfigured ? (
                <p className="mb-2 text-xs text-indigo-400">
                  Configured: {settings.stripeSecretKeyPreview}
                </p>
              ) : (
                <p className="mb-2 text-xs text-amber-400">Not configured — card checkout disabled</p>
              )}
              <input
                type="password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
                placeholder="sk_test_... (enter to set or replace)"
                autoComplete="off"
                className="w-full rounded-lg input-field font-mono text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Webhook signing secret</span>
              {settings?.stripeWebhookConfigured ? (
                <p className="mb-2 text-xs text-indigo-400">
                  Configured: {settings.stripeWebhookPreview}
                </p>
              ) : (
                <p className="mb-2 text-xs text-slate-500">Optional for local dev; required for auto-fulfillment</p>
              )}
              <input
                type="password"
                value={stripeWebhookSecret}
                onChange={(e) => setStripeWebhookSecret(e.target.value)}
                placeholder="whsec_..."
                autoComplete="off"
                className="w-full rounded-lg input-field font-mono text-sm"
              />
            </label>
          </div>

          {settings?.webhookUrl ? (
            <div className="rounded-lg bg-white/50 px-4 py-3 text-sm">
              <p className="text-slate-500">Stripe webhook endpoint URL</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-700">{settings.webhookUrl}</p>
              <p className="mt-2 text-xs text-slate-500">
                Add this URL in Stripe → Developers → Webhooks. Events: checkout.session.completed,
                invoice.payment_failed, customer.subscription.deleted
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {showBank ? (
        <div className="panel-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-400" />
              <h3 className="font-medium text-slate-900">Bank accounts</h3>
            </div>
            {gatewaySettings ? (
              <GatewayStatusBadge
                status={getGatewayStatus(gatewaySettings.bankTransferEnabled)}
              />
            ) : null}
          </div>
          <p className="text-sm text-slate-400">
            Tenants can submit orders without Stripe. You email them an invoice with these bank
            details, then assign numbers after payment is received.
          </p>
          {settings?.manualPaymentEnabled ? (
            <p className="text-xs text-indigo-400">Bank transfer checkout is enabled for tenants.</p>
          ) : (
            <p className="text-xs text-amber-400">Add at least bank name + account details to enable.</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">Bank name</span>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Account name</span>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Account number</span>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Routing number</span>
              <input
                type="text"
                value={bankRoutingNumber}
                onChange={(e) => setBankRoutingNumber(e.target.value)}
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">SWIFT / BIC (optional)</span>
              <input
                type="text"
                value={bankSwiftCode}
                onChange={(e) => setBankSwiftCode(e.target.value)}
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">Payment instructions</span>
              <textarea
                rows={3}
                value={bankPaymentInstructions}
                onChange={(e) => setBankPaymentInstructions(e.target.value)}
                placeholder="e.g. Wire transfer only. Include invoice number in memo."
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">Invoice contact email</span>
              <input
                type="email"
                value={invoiceContactEmail}
                onChange={(e) => setInvoiceContactEmail(e.target.value)}
                placeholder="billing@vsp-voip.com"
                className="w-full rounded-lg input-field"
              />
            </label>
          </div>
        </div>
      ) : null}

      {showTelnyx ? (
        <div className="panel-card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-indigo-400" />
            <h3 className="font-medium text-slate-900">Telnyx voice connection</h3>
          </div>
          <p className="text-sm text-slate-400">
            API key stays in server <code className="text-slate-700">.env</code> as{' '}
            <code className="text-slate-700">TELNYX_API_KEY</code>. TeXML connection ID is for inbound calls;
            credential connection ID is for browser softphone / outbound WebRTC; messaging profile ID is for SMS.
          </p>

          {telnyxStatus ? (
            <div className="rounded-lg bg-white/50 px-4 py-3 text-sm space-y-1">
              <p className={telnyxStatus.connected ? 'text-indigo-400' : 'text-amber-400'}>
                {telnyxStatus.message}
              </p>
              <p className="text-xs text-slate-500">
                API key: {telnyxStatus.apiKeyConfigured ? 'configured in .env' : 'not set'}
              </p>
              {telnyxStatus.webhookUrl ? (
                <p className="text-xs text-slate-500 break-all">
                  Voice webhook: {telnyxStatus.webhookUrl}
                </p>
              ) : null}
              {telnyxStatus.smsWebhookUrl ? (
                <p className="text-xs text-slate-500 break-all">
                  SMS webhook: {telnyxStatus.smsWebhookUrl}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">TeXML connection ID (inbound)</span>
              <input
                type="text"
                value={telnyxConnectionId}
                onChange={(e) => setTelnyxConnectionId(e.target.value)}
                placeholder="Leave blank to use TELNYX_CONNECTION_ID from .env"
                className="w-full rounded-lg input-field font-mono text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">Credential connection ID (softphone / outbound)</span>
              <input
                type="text"
                value={telnyxCredentialConnectionId}
                onChange={(e) => setTelnyxCredentialConnectionId(e.target.value)}
                placeholder="TELNYX_CREDENTIAL_CONNECTION_ID or set here"
                className="w-full rounded-lg input-field font-mono text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">Messaging profile ID (SMS)</span>
              <input
                type="text"
                value={telnyxMessagingProfileId}
                onChange={(e) => setTelnyxMessagingProfileId(e.target.value)}
                placeholder="TELNYX_MESSAGING_PROFILE_ID or set here"
                className="w-full rounded-lg input-field font-mono text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">Call Control application ID (inbound → mobile app)</span>
              <input
                type="text"
                value={telnyxCallControlApplicationId}
                onChange={(e) => setTelnyxCallControlApplicationId(e.target.value)}
                placeholder="TELNYX_CALL_CONTROL_APP_ID or set here"
                className="w-full rounded-lg input-field font-mono text-sm"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Telnyx Portal → Call Control → Applications. Webhook: /webhook/call-control (set automatically when API_PUBLIC_URL is configured).
              </span>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm text-slate-700">Connection label</span>
              <input
                type="text"
                value={telnyxConnectionName}
                onChange={(e) => setTelnyxConnectionName(e.target.value)}
                placeholder="VSP-VOIP Voice App"
                className="w-full rounded-lg input-field"
              />
            </label>
          </div>
        </div>
      ) : null}

      {showMarkup ? (
        <div className="panel-card p-6 space-y-5">
          <h3 className="font-medium text-slate-900">Default VSP-VOIP markup (USD)</h3>
          <p className="text-sm text-slate-400">
            Applied on top of Telnyx carrier cost for each phone number. New tenants inherit these
            defaults; you can override per tenant under Tenants & billing.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Setup (one-time)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={defaultFeeSetup}
                onChange={(e) => setDefaultFeeSetup(e.target.value)}
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">First month</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Same as recurring (${defaultFeeMonthly})`}
                value={defaultFeeFirstMonth}
                onChange={(e) => setDefaultFeeFirstMonth(e.target.value)}
                className="w-full rounded-lg input-field placeholder:text-slate-600"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-slate-700">Recurring monthly</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={defaultFeeMonthly}
                onChange={(e) => setDefaultFeeMonthly(e.target.value)}
                className="w-full rounded-lg input-field"
              />
            </label>
          </div>

          <p className="text-sm text-slate-500">
            Example: carrier ${formatPrice(1.25)}/mo + platform{' '}
            {formatPrice(Number(defaultFeeMonthly) || 0)}/mo = tenant pays{' '}
            {formatPrice((Number(defaultFeeMonthly) || 0) + 1.25)}/mo recurring.
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saveLabel}
      </button>
    </form>
  );
}
