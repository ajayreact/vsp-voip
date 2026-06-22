'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { CartProvider } from '@/context/cart-context';
import { getMe, type User } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => router.push('/login'));
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Loading portal…
      </div>
    );
  }

  return (
    <CartProvider>
      <div className="flex h-screen overflow-hidden bg-slate-100">
        <Sidebar tenantName={user.tenantName} role={user.role} />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-white px-8 py-5 shadow-sm">
            <p className="text-sm text-slate-500">Welcome back</p>
            <h1 className="text-2xl font-semibold text-slate-900">{user.name}</h1>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-8">{children}</div>
        </main>
      </div>
    </CartProvider>
  );
}
