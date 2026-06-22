'use client';

import 'sweetalert2/dist/sweetalert2.min.css';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { useCart } from '@/context/cart-context';
import { completeBillingCheckout } from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

export default function CartSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { clearCart } = useCart();
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('Missing payment session.');
      return;
    }

    completeBillingCheckout(sessionId)
      .then((res) => {
        clearCart();
        setStatus('done');
        setMessage(res.message);
        if (res.failed?.length) {
          void Swal.fire({
            title: 'Partial success',
            text: res.failed.map((f) => `${f.phoneNumber}: ${f.error}`).join('\n'),
            icon: 'warning',
            ...SWAL_THEME,
          });
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Could not complete order');
      });
  }, [sessionId, clearCart]);

  return (
    <div className="mx-auto max-w-lg panel-card p-10 text-center">
      {status === 'loading' ? (
        <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-400" />
          <p className="mt-4 text-slate-700">Confirming payment and assigning numbers…</p>
        </>
      ) : status === 'done' ? (
        <>
          <CheckCircle className="mx-auto h-12 w-12 text-indigo-400" />
          <h2 className="mt-4 text-xl font-semibold text-slate-900">Order complete</h2>
          <p className="mt-2 text-slate-400">{message}</p>
          <Link
            href="/numbers"
            className="mt-6 inline-block rounded-lg bg-indigo-500 px-5 py-2.5 font-medium text-white hover:bg-indigo-400"
          >
            View your numbers
          </Link>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-slate-900">Something went wrong</h2>
          <p className="mt-2 text-red-600">{message}</p>
          <Link href="/cart" className="mt-6 inline-block text-indigo-600 hover:text-indigo-500">
            Back to cart
          </Link>
        </>
      )}
    </div>
  );
}
