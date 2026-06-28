'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/sidebar';
import { CartProvider } from '@/context/cart-context';
import { getMe, type User } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const isFullScreenSoftphone = pathname === '/softphone-v2'
    || pathname.startsWith('/softphone-v2/');

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-500">
        Loading portal…
      </div>
    );
  }

  return (
    <CartProvider>
      {isFullScreenSoftphone ? (
        <div className="h-[100dvh] overflow-hidden bg-[#F5F5F7]">{children}</div>
      ) : (
        <div className="flex h-[100dvh] overflow-hidden bg-slate-100">
          <Sidebar
            tenantName={user.tenantName}
            role={user.role}
            mobileOpen={sidebarOpen}
            onClose={closeSidebar}
          />
          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 lg:px-8 lg:py-5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500 sm:text-sm">Welcome back</p>
                <h1 className="truncate text-lg font-semibold text-slate-900 sm:text-2xl">{user.name}</h1>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      )}
    </CartProvider>
  );
}
