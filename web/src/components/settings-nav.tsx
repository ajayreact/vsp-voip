'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/settings', label: 'Billing & orders' },
  { href: '/settings/subscription', label: 'Subscription' },
  { href: '/settings/payment-methods', label: 'Payment methods', adminOnly: true },
  { href: '/settings/profile', label: 'Company profile' },
  { href: '/settings/team', label: 'Team', adminOnly: true },
];

export function SettingsNav({ role }: { role?: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {links
        .filter((link) => !link.adminOnly || role === 'TENANT_ADMIN')
        .map((link) => {
          const active =
            link.href === '/settings'
              ? pathname === '/settings'
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn('filter-btn', active && 'filter-btn-active')}
            >
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
