'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/settings', label: 'Billing & orders' },
  { href: '/settings/subscription', label: 'Subscription' },
  { href: '/settings/payment-methods', label: 'Payment methods', adminOnly: true },
  { href: '/settings/profile', label: 'Company profile' },
  { href: '/settings/advanced', label: 'Advanced', tenantAdminOnly: true },
  { href: '/employees', label: 'Team', adminOnly: true },
];

export function SettingsNav({ role }: { role?: string }) {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 flex gap-2 overflow-x-auto border-b border-slate-200 px-4 pb-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {links
        .filter((link) => {
          if (link.tenantAdminOnly) return role === 'TENANT_ADMIN';
          if (link.adminOnly) return role === 'TENANT_ADMIN';
          return true;
        })
        .map((link) => {
          const active =
            link.href === '/settings'
              ? pathname === '/settings'
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn('filter-btn shrink-0 whitespace-nowrap', active && 'filter-btn-active')}
            >
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
