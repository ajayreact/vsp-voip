'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { getBillingOrders, type NumberOrder } from '@/lib/api';
import { formatPrice } from '@/lib/pricing';

export default function OrderPlacedPage() {
  const params = useSearchParams();
  const orderId = params.get('orderId');
  const [order, setOrder] = useState<NumberOrder | null>(null);

  useEffect(() => {
    if (!orderId) return;
    getBillingOrders()
      .then((res) => {
        const found = (res.orders || []).find((o) => o.id === orderId);
        if (found) setOrder(found);
      })
      .catch(() => {});
  }, [orderId]);

  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900">Order submitted</h2>
      <p className="mt-3 text-sm text-slate-400">
        Your order is awaiting bank transfer payment. Download the invoice from your order page,
        complete the transfer, then upload payment proof for admin review.
      </p>

      {order ? (
        <div className="mt-8 panel-card p-5 text-left text-sm">
          <dl className="space-y-2">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Invoice ref</dt>
              <dd className="font-mono text-slate-900">{order.invoiceNumber || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Amount due</dt>
              <dd className="font-semibold text-slate-900">{formatPrice(order.totalCharged)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="capitalize text-amber-700">Awaiting payment</dd>
            </div>
            <div>
              <dt className="text-slate-500">Numbers</dt>
              <dd className="mt-1 text-slate-700">{(order.phoneNumbers as string[]).join(', ')}</dd>
            </div>
          </dl>
        </div>
      ) : orderId ? (
        <p className="mt-6 inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading order details…
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {orderId ? (
          <Link href={`/settings/orders/${orderId}`} className="btn-primary px-4 py-2 text-sm">
            Upload payment proof
          </Link>
        ) : null}
        <Link
          href="/settings"
          className="btn-secondary px-4 py-2 text-sm"
        >
          View orders in Settings
        </Link>
        <Link
          href="/numbers"
          className="btn-primary px-4 py-2 text-sm"
        >
          Back to numbers
        </Link>
      </div>
    </div>
  );
}
