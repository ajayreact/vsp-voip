'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const links = [
  { href: '/admin/payments/stripe', label: 'Stripe' },
  { href: '/admin/payments/bank', label: 'Bank accounts' },
];

export function AdminPaymentsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {links.map((link) => {
        const active = pathname.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href} className={cn('filter-btn', active && 'filter-btn-active')}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
