'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LogOut,
  Radio,
  Shield,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearToken, getDashboardStats } from '@/lib/api';
import { useCart } from '@/context/cart-context';
import { AdminNav } from '@/components/admin-nav';
import {
  buildPortalNavSections,
  isPortalNavActive,
  type PortalNavItem,
} from '@/lib/portal-nav';

type SidebarProps = {
  tenantName?: string | null;
  role?: string;
  mobileOpen?: boolean;
  onClose?: () => void;
};

function resolveBadge(
  item: PortalNavItem,
  badges: { voicemail: number; sms: number },
  cartCount: number,
): number {
  if (item.badgeKey === 'voicemail') return badges.voicemail;
  if (item.badgeKey === 'sms') return badges.sms;
  if (item.badgeKey === 'cart') return cartCount;
  return 0;
}

export function Sidebar({ tenantName, role, mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useCart();
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'TENANT_ADMIN' || isSuperAdmin;
  const isAdminRoute = pathname.startsWith('/admin');
  const showAdminNav = isSuperAdmin && (isAdminRoute || !tenantName);
  const showTenantNav = !showAdminNav || (isSuperAdmin && tenantName && !isAdminRoute);
  const navSections = buildPortalNavSections();
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

  useEffect(() => {
    onClose?.();
  }, [pathname, onClose]);

  function handleNavClick() {
    onClose?.();
  }

  const widthClass = showAdminNav ? 'w-72 max-w-[85vw]' : 'w-64 max-w-[85vw]';

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:z-auto lg:max-w-none lg:translate-x-0',
          widthClass,
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-hidden={!mobileOpen ? undefined : false}
      >
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-600">VSP PBX</p>
                <p className="text-xs text-slate-500">Administration Portal</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
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
            <AdminNav onNavigate={handleNavClick} />
          ) : showTenantNav ? (
            <div className="space-y-6">
              {navSections.map((section) => {
                const items = section.items.filter((item) => !item.adminOnly || isAdmin);
                if (!items.length) return null;
                return (
                  <div key={section.id}>
                    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {section.label}
                    </p>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const active = isPortalNavActive(pathname, item);
                        const Icon = item.icon;
                        const navBadge = resolveBadge(item, badges, count);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={handleNavClick}
                            className={cn(
                              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                              active
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            {navBadge > 0 ? (
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
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </nav>

        {isSuperAdmin && tenantName && !isAdminRoute ? (
          <div className="px-3 pb-2">
            <Link
              href="/admin"
              onClick={handleNavClick}
              className="flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
            >
              <Shield className="h-4 w-4 shrink-0" />
              Admin console
            </Link>
          </div>
        ) : null}

        {isSuperAdmin && tenantName && isAdminRoute ? (
          <div className="px-3 pb-2">
            <Link
              href="/dashboard"
              onClick={handleNavClick}
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
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </aside>
    </>
  );
}
