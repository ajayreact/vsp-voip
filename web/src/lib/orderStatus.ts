import type { NumberOrder } from '@/lib/api';

export function orderStatusLabel(order: Pick<
  NumberOrder,
  'status' | 'paymentMethod' | 'invoiceSentAt' | 'paymentReviewStatus' | 'paymentProofUrl'
>) {
  if (order.status === 'CANCELLED') {
    return order.paymentReviewStatus === 'REJECTED' ? 'Payment rejected' : 'Cancelled';
  }
  if (order.status === 'FAILED') return 'Failed';
  if (order.status === 'PARTIAL') return 'Partially fulfilled';

  if (order.status === 'FULFILLED') return 'Numbers active';

  if (order.status === 'PAID') {
    return order.paymentMethod === 'MANUAL_BANK'
      ? 'Payment confirmed — assigning numbers'
      : 'Paid — assigning numbers';
  }

  if (order.status === 'PENDING_PAYMENT') {
    if (order.paymentReviewStatus === 'PENDING') return 'Payment proof under review';
    if (order.paymentProofUrl) return 'Proof uploaded — awaiting review';
    return 'Awaiting bank payment';
  }

  if (order.status === 'PENDING') {
    if (order.paymentMethod === 'MANUAL_BANK') {
      return order.invoiceSentAt ? 'Awaiting bank payment' : 'Invoice being prepared';
    }
    return 'Awaiting payment';
  }

  return order.status;
}

export function orderStatusTone(
  status: string,
  paymentReviewStatus?: string,
): 'amber' | 'blue' | 'emerald' | 'red' | 'slate' | 'orange' {
  if (paymentReviewStatus === 'REJECTED') return 'red';
  if (paymentReviewStatus === 'PENDING') return 'blue';
  const map: Record<string, 'amber' | 'blue' | 'emerald' | 'red' | 'slate' | 'orange'> = {
    PENDING: 'amber',
    PENDING_PAYMENT: 'amber',
    PAID: 'blue',
    FULFILLED: 'emerald',
    PARTIAL: 'orange',
    FAILED: 'red',
    CANCELLED: 'slate',
  };
  return map[status] || 'slate';
}

export function orderStatusBadgeClass(tone: ReturnType<typeof orderStatusTone>) {
  const map = {
    amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    slate: 'bg-slate-100 text-slate-600',
    orange: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  };
  return map[tone];
}
