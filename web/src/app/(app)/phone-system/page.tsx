'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PhoneSystemPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/phone-system/extensions');
  }, [router]);

  return <div className="py-24 text-center text-slate-400">Redirecting…</div>;
}
