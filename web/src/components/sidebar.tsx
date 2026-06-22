'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Phone,
  History,
  MessageSquare,
  Settings,
  LogOut,
  Radio,
  ShoppingCart,
  Shield,
  Voicemail,
  Mic,
  PhoneCall,
  MessagesSquare,
  Network,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearToken, getDashboardStats } from '@/lib/api';
import { useCart } from '@/context/cart-context';
import { AdminNav } from '@/components/admin-nav';

const tenantNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/my-numbers', label: 'My Numbers', icon: Phone },
  { href: '/softphone', label: 'Softphone', icon: PhoneCall },
  { href: '/phone-system/extensions', label: 'Phone system', icon: Network },
  { href: '/sms', label: 'SMS', icon: MessagesSquare },
  { href: '/numbers', label: 'Buy Numbers', icon: ShoppingCart },
  { href: '/greeting', label: 'Call routing', icon: MessageSquare },
  { href: '/voicemail', label: 'Voicemail', icon: Voicemail },
  { href: '/recordings', label: 'Recordings', icon: Mic },
  { href: '/calls', label: 'Call History', icon: History },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isNavActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ tenantName, role }: { tenantName?: string | null; role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdminRoute = pathname.startsWith('/admin');
  const showAdminNav = isSuperAdmin && (isAdminRoute || !tenantName);
  const showTenantNav = !showAdminNav || (isSuperAdmin && tenantName && !isAdminRoute);
  const [badges, setBadges] = useState({ voicemail: 0, sms: 0 });

  useEffect(() => {
    if (showAdminNav || !tenantName) return;
    getDashboardStats()
      .then((stats) => {
        setBadges({
          voicemail: stats.unreadVoicemailCount || 0,
          sms: stats.unreadSmsCount || 0,
        });
      })
      .catch(() => {});
  }, [showAdminNav, tenantName, pathname]);

  return (
    <aside className={cn('sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm', showAdminNav ? 'w-72' : 'w-64')}>
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-600">VSP-VOIP</p>
            <p className="text-xs text-slate-500">Cloud Phone Platform</p>
          </div>
        </div>
        {tenantName ? (
          <p className="mt-4 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            {tenantName}
          </p>
        ) : isSuperAdmin ? (
          <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            Platform super admin
          </p>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {showAdminNav ? (
          <AdminNav />
        ) : showTenantNav ? (
          <div className="space-y-1">
            {tenantNav.map(({ href, label, icon: Icon }) => {
              const active = isNavActive(pathname, href);
              const showBadge = href === '/cart' && count > 0;
              const unreadVoicemail = href === '/voicemail' ? badges.voicemail : 0;
              const unreadSms = href === '/sms' ? badges.sms : 0;
              const navBadge = unreadVoicemail || unreadSms;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{label}</span>
                  {showBadge ? (
                    <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-medium text-white">
                      {count}
                    </span>
                  ) : navBadge > 0 ? (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        active ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700',
                      )}
                    >
                      {navBadge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <Link
              href="/cart"
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                pathname.startsWith('/cart')
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <ShoppingCart className="h-4 w-4" />
              <span className="flex-1">My Cart</span>
              {count > 0 ? (
                <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-xs font-medium text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          </div>
        ) : null}
      </nav>

      {isSuperAdmin && tenantName && !isAdminRoute ? (
        <div className="px-3 pb-2">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
          >
            <Shield className="h-4 w-4" />
            Admin console
          </Link>
        </div>
      ) : null}

      {isSuperAdmin && tenantName && isAdminRoute ? (
        <div className="px-3 pb-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Switch to tenant portal
          </Link>
        </div>
      ) : null}

      <button
        onClick={() => {
          clearToken();
          router.push('/login');
        }}
        className="mx-3 mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
