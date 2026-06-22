'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin/settings', label: 'Telnyx & markup' },
  { href: '/admin/payments/stripe', label: 'Payments' },
];

export function AdminSettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {links.map((link) => {
        const active =
          link.href === '/admin/settings'
            ? pathname === '/admin/settings'
            : pathname.startsWith('/admin/payments');
        return (
          <Link key={link.href} href={link.href} className={cn('filter-btn', active && 'filter-btn-active')}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
