'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ExternalLink,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  XCircle,
} from 'lucide-react';
import Swal from 'sweetalert2';
import {
  approveAdminOrderPayment,
  cancelAdminOrder,
  getAdminOrder,
  getMe,
  markAdminOrderInvoiceSent,
  rejectAdminOrderPayment,
  refundAdminRazorpayOrder,
  updateAdminOrder,
  type InvoicePreview,
  type NumberOrder,
} from '@/lib/api';
import { formatPrice } from '@/lib/pricing';
import { SWAL_THEME } from '@/lib/swal-theme';

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [order, setOrder] = useState<NumberOrder | null>(null);
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);
  const [mailtoLink, setMailtoLink] = useState<string | null>(null);
  const [tenantEmail, setTenantEmail] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [savingRef, setSavingRef] = useState(false);

  async function reload() {
    const res = await getAdminOrder(id);
    setOrder(res.order);
    setInvoice(res.invoice);
    setMailtoLink(res.mailtoLink);
    setTenantEmail(res.tenantAdminEmail);
    setPaymentReference(res.order.paymentReference || '');
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (user.role !== 'SUPER_ADMIN') {
          router.replace('/dashboard');
          return;
        }
        return reload();
      })
      .catch(() => router.replace('/admin/orders'))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function copyInvoice() {
    if (!invoice?.body) return;
    await navigator.clipboard.writeText(invoice.body);
    await Swal.fire({
      title: 'Copied',
      text: 'Invoice text copied to clipboard. Paste into your email client.',
      icon: 'success',
      timer: 1800,
      showConfirmButton: false,
      ...SWAL_THEME,
    });
  }

  async function onEmailInvoice() {
    if (mailtoLink) {
      window.location.href = mailtoLink;
    }
    try {
      const res = await markAdminOrderInvoiceSent(id, tenantEmail || undefined, false);
      await reload();
      if (res.emailResult && !res.emailResult.sent && res.emailResult.reason) {
        // mailto only path — no error
      }
    } catch (err) {
      await Swal.fire({
        title: 'Could not update',
        text: err instanceof Error ? err.message : 'Failed to mark invoice sent',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  async function onSendInvoiceEmail() {
    try {
      const res = await markAdminOrderInvoiceSent(id, tenantEmail || undefined, true);
      await reload();
      if (res.emailResult?.sent) {
        await Swal.fire({
          title: 'Invoice sent',
          text: `Email sent to ${tenantEmail || 'tenant admin'}.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          ...SWAL_THEME,
        });
      } else {
        await Swal.fire({
          title: res.emailResult?.reason?.includes('SMTP') ? 'SMTP not configured' : 'Email not sent',
          html: `
            <p style="margin:0 0 8px">${res.emailResult?.reason || 'Use copy/mailto instead.'}</p>
            <p style="color:#94a3b8;font-size:0.875rem;margin:0">Add SMTP_HOST and SMTP_FROM to server .env for automatic sending.</p>
          `,
          icon: 'info',
          ...SWAL_THEME,
        });
      }
    } catch (err) {
      await Swal.fire({
        title: 'Send failed',
        text: err instanceof Error ? err.message : 'Could not send invoice',
        icon: 'error',
        ...SWAL_THEME,
      });
    }
  }

  async function onSaveReference() {
    setSavingRef(true);
    try {
      await updateAdminOrder(id, { paymentReference: paymentReference.trim() || undefined });
      await reload();
    } catch (err) {
      await Swal.fire({
        title: 'Save failed',
        text: err instanceof Error ? err.message : 'Could not save reference',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSavingRef(false);
    }
  }

  async function onApprovePayment() {
    const result = await Swal.fire({
      title: 'Approve payment?',
      html: `
        <p style="margin:0 0 8px">Confirm payment of ${formatPrice(order?.totalCharged)} from <strong>${order?.tenantName}</strong>.</p>
        <p style="color:#94a3b8;font-size:0.875rem;margin:0">This will purchase numbers on Telnyx and assign them to the tenant.</p>
      `,
      input: 'text',
      inputLabel: 'Payment reference (optional)',
      inputValue: paymentReference || order?.invoiceNumber || '',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Approve & assign numbers',
      cancelButtonText: 'Cancel',
      ...SWAL_THEME,
    });
    if (!result.isConfirmed) return;

    setWorking(true);
    try {
      const res = await approveAdminOrderPayment(id, {
        paymentReference: result.value?.trim() || paymentReference.trim() || undefined,
      });
      await reload();
      await Swal.fire({
        title: res.failed?.length ? 'Partially fulfilled' : 'Payment approved',
        text: res.message,
        icon: res.failed?.length ? 'warning' : 'success',
        ...SWAL_THEME,
      });
    } catch (err) {
      await Swal.fire({
        title: 'Approval failed',
        text: err instanceof Error ? err.message : 'Could not approve payment',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setWorking(false);
    }
  }

  async function onRejectPayment() {
    const result = await Swal.fire({
      title: 'Reject payment?',
      text: 'The order will be cancelled. The tenant can place a new order.',
      input: 'textarea',
      inputLabel: 'Reason (optional)',
      inputPlaceholder: 'e.g. Amount mismatch, unclear proof',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Reject payment',
      cancelButtonText: 'Cancel',
      ...SWAL_THEME,
    });
    if (!result.isConfirmed) return;

    setWorking(true);
    try {
      await rejectAdminOrderPayment(id, result.value?.trim() || undefined);
      await reload();
    } catch (err) {
      await Swal.fire({
        title: 'Reject failed',
        text: err instanceof Error ? err.message : 'Could not reject payment',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setWorking(false);
    }
  }

  async function onCancel() {
    const result = await Swal.fire({
      title: 'Cancel order?',
      text: 'The tenant will need to place a new order.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cancel order',
      cancelButtonText: 'Keep order',
      ...SWAL_THEME,
    });
    if (!result.isConfirmed) return;

    setWorking(true);
    try {
      await cancelAdminOrder(id);
      await reload();
    } catch (err) {
      await Swal.fire({
        title: 'Cancel failed',
        text: err instanceof Error ? err.message : 'Could not cancel',
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setWorking(false);
    }
  }

  if (loading || !order || !invoice) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading order…
      </div>
    );
  }

  const canReviewProof =
    order.paymentMethod === 'MANUAL_BANK'
    && order.paymentReviewStatus === 'PENDING'
    && Boolean(order.paymentProofUrl);
  const canCancel =
    order.paymentMethod === 'MANUAL_BANK'
    && ['PENDING', 'PENDING_PAYMENT'].includes(order.status)
    && order.paymentReviewStatus !== 'APPROVED';
  const isBankOrder = order.paymentMethod === 'MANUAL_BANK';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/orders"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          All orders
        </Link>
        <h2 className="text-lg font-medium text-slate-900">
          Order {order.invoiceNumber || order.id.slice(0, 8)}
        </h2>
        <p className="text-sm text-slate-400">
          {order.tenantName} · {formatPrice(order.totalCharged)} ·{' '}
          {order.paymentMethod === 'STRIPE' ? 'Stripe' : order.paymentMethod === 'RAZORPAY' ? 'Razorpay' : 'Bank transfer'} ·{' '}
          <span className="capitalize">{order.status.toLowerCase()}</span>
        </p>
      </div>

      {order.paymentProofUrl ? (
        <div className="panel-card p-5">
          <h3 className="font-medium text-slate-900">Payment proof</h3>
          <p className="mt-1 text-sm text-slate-500">
            Uploaded{' '}
            {order.paymentProofUploadedAt
              ? new Date(order.paymentProofUploadedAt).toLocaleString()
              : ''}
            {' · '}
            Review: {order.paymentReviewStatus || 'NONE'}
          </p>
          <a
            href={order.paymentProofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-500"
          >
            View proof
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      ) : null}

      <div className="panel-card p-5 space-y-4">
        <h3 className="font-medium text-slate-900">Payment reference</h3>
        <p className="text-sm text-slate-400">
          Bank transfer ID, wire reference, or Stripe payment intent — for your records.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="e.g. WIRE-20260618-001"
            className="min-w-[240px] flex-1 rounded-lg input-field text-sm"
          />
          <button
            type="button"
            onClick={onSaveReference}
            disabled={savingRef}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {savingRef ? 'Saving…' : 'Save reference'}
          </button>
        </div>
      </div>

      <div className="panel-card p-5">
        <h3 className="font-medium text-slate-900">Numbers</h3>
        <p className="mt-2 text-sm text-slate-700">{(order.phoneNumbers as string[]).join(', ')}</p>
        {tenantEmail ? (
          <p className="mt-3 text-sm text-slate-500">Tenant contact: {tenantEmail}</p>
        ) : null}
      </div>

      {isBankOrder ? (
      <div className="panel-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h3 className="font-medium text-slate-900">Invoice email</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyInvoice}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Copy className="h-4 w-4" />
              Copy text
            </button>
            <button
              type="button"
              onClick={onEmailInvoice}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Mail className="h-4 w-4" />
              Open in email app
            </button>
            <button
              type="button"
              onClick={onSendInvoiceEmail}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
            >
              <Mail className="h-4 w-4" />
              Send via SMTP
            </button>
          </div>
        </div>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap p-5 text-xs leading-relaxed text-slate-700">
          {invoice.body}
        </pre>
        {order.invoiceSentAt ? (
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-indigo-400">
            Invoice marked sent {new Date(order.invoiceSentAt).toLocaleString()}
            {order.invoiceEmailTo ? ` to ${order.invoiceEmailTo}` : ''}
          </p>
        ) : (
          <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
            Send the invoice manually, then click “Open email / mark sent” to track it.
          </p>
        )}
      </div>
      ) : order.paymentMethod === 'RAZORPAY' ? (
        <div className="panel-card p-5">
          <h3 className="font-medium text-slate-900">Razorpay payment</h3>
          <p className="mt-2 text-sm text-slate-400">
            Paid via Razorpay. Numbers are assigned after payment verification.
          </p>
          {order.status === 'FULFILLED' && !order.refundedAt ? (
            <button
              type="button"
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'Issue Razorpay refund?',
                  input: 'textarea',
                  inputLabel: 'Reason',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonText: 'Refund',
                  ...SWAL_THEME,
                });
                if (!result.isConfirmed) return;
                setWorking(true);
                try {
                  await refundAdminRazorpayOrder(id, result.value?.trim() || undefined);
                  await reload();
                  await Swal.fire({ title: 'Refund processed', icon: 'success', ...SWAL_THEME });
                } catch (err) {
                  await Swal.fire({
                    title: 'Refund failed',
                    text: err instanceof Error ? err.message : 'Could not refund',
                    icon: 'error',
                    ...SWAL_THEME,
                  });
                } finally {
                  setWorking(false);
                }
              }}
              disabled={working}
              className="mt-4 rounded-lg border border-amber-300 px-4 py-2 text-sm text-amber-800 hover:bg-amber-50 disabled:opacity-50"
            >
              Issue refund
            </button>
          ) : null}
        </div>
      ) : (
        <div className="panel-card p-5">
          <h3 className="font-medium text-slate-900">Stripe payment</h3>
          <p className="mt-2 text-sm text-slate-400">
            This order was paid by card. Numbers are assigned automatically when Stripe checkout completes.
          </p>
          {order.status === 'FULFILLED' ? (
            <p className="mt-3 text-sm text-indigo-400">Order fulfilled via Stripe webhook.</p>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {canReviewProof ? (
          <>
            <button
              type="button"
              onClick={onApprovePayment}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {working ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve payment
            </button>
            <button
              type="button"
              onClick={onRejectPayment}
              disabled={working}
              className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Reject payment
            </button>
          </>
        ) : null}

        {order.status === 'FULFILLED' || order.status === 'PARTIAL' ? (
          <span className="inline-flex items-center gap-2 text-sm text-indigo-400">
            <CheckCircle2 className="h-4 w-4" />
            Numbers assigned
          </span>
        ) : null}

        {canCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2.5 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            Cancel order
          </button>
        ) : null}
      </div>
    </div>
  );
}
