'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CreditCard, IndianRupee, Loader2, ShoppingCart, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useCart } from '@/context/cart-context';
import { DataTable } from '@/components/data-table';
import {
  createBillingCheckoutSession,
  createManualOrder,
  createRazorpayOrder,
  getBillingConfig,
  getConnections,
  verifyRazorpayPayment,
  type BillingConfig,
  type VoiceConnection,
} from '@/lib/api';
import { calculateTenantPricing, formatPrice, perNumberPricing } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

function tenantLinePrice(
  upfront: string | null,
  monthly: string | null,
  config: BillingConfig,
) {
  const { dueToday, recurringMonthly } = perNumberPricing(upfront, monthly, config);
  return { dueToday, recurringMonthly };
}

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, clearCart } = useCart();
  const [connections, setConnections] = useState<VoiceConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [billing, setBilling] = useState<BillingConfig | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank' | 'razorpay'>('bank');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    getConnections()
      .then((res) => {
        const list = res.connections || [];
        setConnections(list);
        setConnectionId(res.defaultConnectionId || list[0]?.id || '');
      })
      .catch(() => setConnections([]));

    getBillingConfig()
      .then((res) => {
        const config: BillingConfig = {
          platformFeeSetup: res.platformFeeSetup,
          platformFeeMonthly: res.platformFeeMonthly,
          platformFeeFirstMonth: res.platformFeeFirstMonth,
          currency: res.currency,
          stripeEnabled: res.stripeEnabled,
          manualPaymentEnabled: res.manualPaymentEnabled,
          razorpayEnabled: res.razorpayEnabled,
          razorpayVisible: res.razorpayVisible,
          gateways: res.gateways,
          bankDetails: res.bankDetails,
        };
        setBilling(config);
        if (config.manualPaymentEnabled) setPaymentMethod('bank');
        else if (config.razorpayEnabled) setPaymentMethod('razorpay');
        else if (config.stripeEnabled) setPaymentMethod('stripe');
      })
      .catch(() =>
        setBilling({
          platformFeeSetup: 0,
          platformFeeMonthly: 8,
          platformFeeFirstMonth: 8,
          currency: 'usd',
          stripeEnabled: false,
          manualPaymentEnabled: false,
        }),
      );
  }, []);

  const pricing = useMemo(() => {
    if (!billing) return null;
    return calculateTenantPricing(items, billing);
  }, [items, billing]);

  async function onEmptyCart() {
    const result = await Swal.fire({
      title: 'Empty cart?',
      text: 'All numbers will be removed from your cart.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Empty cart',
      cancelButtonText: 'Keep items',
      reverseButtons: true,
      ...SWAL_THEME,
    });
    if (result.isConfirmed) clearCart();
  }

  async function onPlaceOrder() {
    if (!items.length || !billing || !pricing) return;

    if (connections.length && !connectionId) {
      await Swal.fire({
        title: 'Voice routing required',
        text: 'Select a VSP-VOIP voice app before checkout.',
        icon: 'warning',
        confirmButtonText: 'OK',
        ...SWAL_THEME,
      });
      return;
    }

    const payByCard = paymentMethod === 'stripe' && billing.stripeEnabled;
    const payByBank = paymentMethod === 'bank' && billing.manualPaymentEnabled;
    const payByRazorpay = paymentMethod === 'razorpay' && billing.razorpayEnabled;

    if (!payByCard && !payByBank && !payByRazorpay) {
      await Swal.fire({
        title: 'No payment method available',
        text: 'Contact your VSP-VOIP administrator to configure a payment gateway.',
        icon: 'warning',
        ...SWAL_THEME,
      });
      return;
    }
    const title = payByCard
      ? 'Proceed to card payment?'
      : payByRazorpay
        ? 'Proceed to Razorpay?'
        : 'Submit order for invoice?';

    const result = await Swal.fire({
      title,
      html: `
        <p style="margin:0 0 8px">${items.length} number(s)</p>
        <p style="color:#94a3b8;font-size:0.875rem;margin:0">
          Due today: ${formatPrice(pricing.orderTotal)}<br/>
          Then ${formatPrice(pricing.recurringMonthly)}/mo (includes VSP-VOIP platform fee)
          ${payByBank ? '<br/><br/>Place your order, then upload payment proof from your order page.' : ''}
          ${payByRazorpay ? '<br/><br/>You will be redirected to Razorpay secure checkout (INR).' : ''}
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: payByCard ? 'Pay with card' : payByRazorpay ? 'Pay with Razorpay' : 'Submit order',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      ...SWAL_THEME,
    });

    if (!result.isConfirmed) return;

    setPlacing(true);
    try {
      if (payByCard) {
        const session = await createBillingCheckoutSession(items, connectionId || undefined);
        window.location.href = session.url;
        return;
      }

      if (payByRazorpay) {
        const rzpOrder = await createRazorpayOrder(items, connectionId || undefined);
        const loaded = await new Promise<boolean>((resolve) => {
          if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
            resolve(true);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
        if (!loaded) {
          throw new Error('Could not load Razorpay checkout');
        }

        const RazorpayCtor = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }).Razorpay;
        const rzp = new RazorpayCtor({
          key: rzpOrder.razorpayKeyId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          name: 'VSP-VOIP',
          description: `${items.length} phone number(s)`,
          order_id: rzpOrder.razorpayOrderId,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verify = await verifyRazorpayPayment({
                orderId: rzpOrder.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              });
              clearCart();
              await Swal.fire({
                title: verify.failed?.length ? 'Partially fulfilled' : 'Payment successful',
                text: verify.message,
                icon: verify.failed?.length ? 'warning' : 'success',
                ...SWAL_THEME,
              });
              router.push(`/cart/success?orderId=${rzpOrder.orderId}`);
            } catch (verifyErr) {
              await Swal.fire({
                title: 'Verification failed',
                text: verifyErr instanceof Error ? verifyErr.message : 'Could not verify payment',
                icon: 'error',
                ...SWAL_THEME,
              });
            } finally {
              setPlacing(false);
            }
          },
          modal: {
            ondismiss: () => setPlacing(false),
          },
        });
        rzp.open();
        return;
      }

      const manual = await createManualOrder(items, connectionId || undefined);
      clearCart();
      router.push(`/cart/order-placed?orderId=${manual.order.id}`);
    } catch (err) {
      await Swal.fire({
        title: 'Checkout failed',
        text: err instanceof Error ? err.message : 'Could not start checkout',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/numbers"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to buy numbers
          </Link>
          <h2 className="text-lg font-medium text-slate-900">My Cart</h2>
          <p className="text-sm text-slate-400">Review and pay through VSP-VOIP billing</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
          <ShoppingCart className="h-5 w-5" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {!items.length ? (
            <div className="panel-card px-5 py-16 text-center">
              <p className="text-slate-400">Your cart is empty</p>
              <Link href="/numbers" className="mt-4 inline-block text-indigo-600 hover:text-indigo-500">
                Search numbers to add
              </Link>
            </div>
          ) : (
            <>
              <DataTable
                title="Number orders"
                data={items}
                getRowId={(item) => item.phoneNumber}
                defaultPageSize={10}
                columns={[
                  {
                    key: 'country',
                    header: 'Country',
                    sortable: true,
                    render: (item) => item.countryLabel || item.country,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    searchable: false,
                    sortable: false,
                    render: () => (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        Ready to order
                      </span>
                    ),
                  },
                  {
                    key: 'phoneNumber',
                    header: 'Number',
                    sortable: true,
                    render: (item) => <span className="font-medium text-slate-900">{item.phoneNumber}</span>,
                  },
                  {
                    key: 'price',
                    header: 'Your price (1st mo)',
                    sortable: true,
                    sortValue: (item) =>
                      billing ? tenantLinePrice(item.upfrontCost, item.monthlyCost, billing).dueToday : 0,
                    render: (item) => {
                      const line = billing
                        ? tenantLinePrice(item.upfrontCost, item.monthlyCost, billing)
                        : null;
                      return (
                        <>
                          {line ? formatPrice(line.dueToday) : '—'}
                          {billing ? (
                            <p className="text-xs text-slate-500">
                              then {formatPrice(line?.recurringMonthly)}/mo
                            </p>
                          ) : null}
                        </>
                      );
                    },
                  },
                  {
                    key: 'actions',
                    header: 'Actions',
                    searchable: false,
                    sortable: false,
                    className: 'text-right',
                    render: (item) => (
                      <button
                        type="button"
                        onClick={() => removeItem(item.phoneNumber)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        aria-label="Remove from cart"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ),
                  },
                ]}
              />

              <div className="panel-card space-y-4 p-5">
                  <div>
                    <label className="mb-1.5 block text-sm text-slate-700">Voice routing app</label>
                    <p className="mb-2 text-xs text-slate-500">
                      Routes inbound calls to your VSP-VOIP greeting and call handling.
                    </p>
                    <select
                      value={connectionId}
                      onChange={(e) => setConnectionId(e.target.value)}
                      className="w-full rounded-lg input-field"
                      disabled={!connections.length}
                    >
                      {!connections.length ? (
                        <option value="">Not configured — contact your administrator</option>
                      ) : connections.length === 1 ? (
                        <option value={connections[0].id}>{connections[0].label}</option>
                      ) : (
                        <>
                          <option value="">Select voice app</option>
                          {connections.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={onEmptyCart}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    Empty Cart
                  </button>
                </div>
              </>
            )}
        </div>

        <div className="h-fit panel-card p-5 xl:sticky xl:top-8">
          <h3 className="mb-4 font-medium text-slate-900">Order Summary</h3>
          {pricing && billing ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <dt>Carrier (upfront + 1st month)</dt>
                <dd>{formatPrice(pricing.carrierUpfront + pricing.carrierMonthly)}</dd>
              </div>
              <div className="flex justify-between text-slate-400">
                <dt>Platform setup</dt>
                <dd>{formatPrice(pricing.platformUpfront)}</dd>
              </div>
              <div className="flex justify-between text-slate-400">
                <dt>Platform first month</dt>
                <dd>{formatPrice(pricing.platformFirstMonth)}</dd>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between font-semibold text-slate-900">
                <dt>Due today</dt>
                <dd>{formatPrice(pricing.orderTotal)}</dd>
              </div>
              <div className="flex justify-between text-slate-400 text-xs">
                <dt>Then monthly</dt>
                <dd>{formatPrice(pricing.recurringMonthly)}/mo</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Loading pricing…</p>
          )}

          {billing && (billing.stripeEnabled || billing.manualPaymentEnabled || billing.razorpayEnabled) ? (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Payment method</p>
              {billing.manualPaymentEnabled ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white/50 p-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'bank'}
                    onChange={() => setPaymentMethod('bank')}
                    className="mt-1"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-900">
                      <Building2 className="h-4 w-4 text-indigo-400" />
                      Bank transfer (invoice)
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Pay by bank transfer. Upload proof after placing the order. Numbers assigned after admin approval.
                    </span>
                  </span>
                </label>
              ) : null}
              {billing.stripeEnabled ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white/50 p-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'stripe'}
                    onChange={() => setPaymentMethod('stripe')}
                    className="mt-1"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-900">
                      <CreditCard className="h-4 w-4 text-indigo-400" />
                      Card (Stripe)
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Pay now with card. Automatic recurring billing.
                    </span>
                  </span>
                </label>
              ) : null}
              {billing.razorpayEnabled ? (
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white/50 p-3">
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'razorpay'}
                    onChange={() => setPaymentMethod('razorpay')}
                    className="mt-1"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm text-slate-900">
                      <IndianRupee className="h-4 w-4 text-indigo-400" />
                      Razorpay
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Pay securely via Razorpay (UPI, cards, netbanking). Numbers assigned after payment.
                    </span>
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onPlaceOrder}
            disabled={!items.length || placing || !billing}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 btn-primary px-4 py-2.5 text-sm w-full justify-center disabled:opacity-50"
          >
            {placing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting…
              </>
            ) : (
              <>
                {paymentMethod === 'stripe' && billing?.stripeEnabled ? (
                  <CreditCard className="h-4 w-4" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                {paymentMethod === 'stripe' && billing?.stripeEnabled
                  ? 'Pay & place order'
                  : 'Submit order for invoice'}
              </>
            )}
          </button>
          {paymentMethod === 'stripe' && billing?.stripeEnabled ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              Secure card payment powered by Stripe
            </p>
          ) : billing?.manualPaymentEnabled ? (
            <p className="mt-3 text-center text-xs text-slate-500">
              Invoice with bank details sent manually by VSP-VOIP admin
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
