'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, Loader2, Upload } from 'lucide-react';
import {
  getBillingOrder,
  downloadBillingInvoice,
  uploadOrderPaymentProof,
  type NumberOrder,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';
import { orderStatusBadgeClass, orderStatusLabel, orderStatusTone } from '@/lib/orderStatus';

export default function TenantOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<NumberOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const res = await getBillingOrder(id);
    setOrder(res.order);
  }

  useEffect(() => {
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load order'))
      .finally(() => setLoading(false));
  }, [id]);

  async function onUploadProof(file: File) {
    setUploading(true);
    setError('');
    try {
      const res = await uploadOrderPaymentProof(id, file);
      setOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading order…
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-medium text-red-700">Order not found</p>
        <p className="mt-2 text-sm text-slate-400">{error || 'This order may not belong to your account.'}</p>
        <Link href="/settings" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500">
          Back to settings
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const tone = orderStatusTone(order.status, order.paymentReviewStatus);
  const awaitingProof =
    order.paymentMethod === 'MANUAL_BANK'
    && ['PENDING', 'PENDING_PAYMENT'].includes(order.status)
    && order.paymentReviewStatus !== 'PENDING'
    && order.paymentReviewStatus !== 'APPROVED';

  const steps = [
    {
      label: 'Order placed',
      done: true,
      detail: new Date(order.createdAt).toLocaleString(),
    },
    {
      label: 'Bank transfer payment',
      done: Boolean(order.paymentProofUrl) || ['PAID', 'FULFILLED', 'PARTIAL'].includes(order.status),
      detail: order.paymentProofUrl
        ? `Proof uploaded ${order.paymentProofUploadedAt ? new Date(order.paymentProofUploadedAt).toLocaleString() : ''}`
        : 'Transfer the amount and upload your receipt or screenshot',
    },
    {
      label: 'Admin review',
      done: order.paymentReviewStatus === 'APPROVED' || ['PAID', 'FULFILLED', 'PARTIAL'].includes(order.status),
      detail:
        order.paymentReviewStatus === 'PENDING'
          ? 'Your payment proof is being reviewed'
          : order.paymentReviewStatus === 'REJECTED'
            ? 'Payment was rejected — contact support'
            : order.paymentReviewStatus === 'APPROVED'
              ? 'Payment approved'
              : 'Waiting for payment proof',
    },
    {
      label: 'Numbers active',
      done: order.status === 'FULFILLED',
      detail: order.status === 'FULFILLED' ? 'Assigned to your account' : 'Waiting for fulfillment',
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Settings
        </Link>
        <h2 className="text-lg font-medium text-slate-900">
          Order {order.invoiceNumber || order.id.slice(0, 8)}
        </h2>
        <p className="text-sm text-slate-400">
          {order.paymentMethod === 'MANUAL_BANK' ? 'Bank transfer' : 'Card (Stripe)'} ·{' '}
          {formatPrice(order.totalCharged)} due at checkout
        </p>
        {order.invoiceNumber ? (
          <button
            type="button"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await downloadBillingInvoice(order.id);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Download failed');
              } finally {
                setDownloading(false);
              }
            }}
            className="mt-3 inline-flex items-center gap-2 btn-secondary px-3 py-1.5 text-sm disabled:opacity-60"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download invoice
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="panel-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium text-slate-900">Status</h3>
          <span className={`rounded-full px-3 py-1 text-sm ${orderStatusBadgeClass(tone)}`}>
            {orderStatusLabel(order)}
          </span>
        </div>
        <ol className="mt-5 space-y-4">
          {steps.map((step) => (
            <li key={step.label} className="flex gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  step.done
                    ? 'bg-indigo-500/20 text-indigo-700'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step.done ? '✓' : '·'}
              </span>
              <div>
                <p className={`text-sm ${step.done ? 'text-slate-900' : 'text-slate-500'}`}>{step.label}</p>
                <p className="text-xs text-slate-500">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {awaitingProof ? (
        <div className="panel-card p-5 space-y-4">
          <h3 className="font-medium text-slate-900">Upload payment proof</h3>
          <p className="text-sm text-slate-500">
            After completing your bank transfer, upload a receipt, screenshot, or PDF (max 5 MB).
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUploadProof(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Uploading…' : 'Choose file'}
          </button>
        </div>
      ) : null}

      {order.paymentProofUrl ? (
        <div className="panel-card p-5">
          <h3 className="font-medium text-slate-900">Payment proof</h3>
          <a
            href={order.paymentProofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-500"
          >
            View uploaded file
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}

      <div className="panel-card p-5">
        <h3 className="font-medium text-slate-900">Numbers in this order</h3>
        <p className="mt-2 text-sm text-slate-700">{(order.phoneNumbers as string[]).join(', ')}</p>
        {order.recurringMonthly != null ? (
          <p className="mt-3 text-sm text-slate-500">
            Recurring after first month: {formatPrice(order.recurringMonthly)}/mo estimated
          </p>
        ) : null}
      </div>

      {order.paymentMethod === 'MANUAL_BANK'
      && ['PENDING', 'PENDING_PAYMENT'].includes(order.status)
      && !order.paymentProofUrl ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900/90">
          Pay the invoice amount by bank transfer, then upload your payment proof above. Numbers
          are assigned after VSP-VOIP confirms payment.
        </div>
      ) : null}
    </div>
  );
}
