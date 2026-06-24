'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Tab = { href: string; label: string; exact?: boolean };

export function AdminSectionNav({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn('filter-btn', active && 'filter-btn-active')}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export const adminSettingsTabs = [
  { href: '/admin/settings/platform', label: 'Platform' },
  { href: '/admin/settings/carrier', label: 'Carrier' },
  { href: '/admin/settings/billing', label: 'Billing' },
  { href: '/admin/settings/security', label: 'Security' },
];

export const adminBillingTabs = [
  { href: '/admin/billing', label: 'Overview', exact: true },
  { href: '/admin/billing/orders', label: 'Orders & invoices' },
  { href: '/admin/billing/payment-gateways', label: 'Payment gateways' },
  { href: '/admin/billing/revenue', label: 'Revenue analytics' },
  { href: '/admin/billing/revenue-protection', label: 'Revenue protection' },
  { href: '/admin/billing/razorpay-reports', label: 'Razorpay reports' },
];

export const adminMonitoringTabs = [
  { href: '/admin/monitoring/telephony-health', label: 'Telephony health' },
  { href: '/admin/monitoring/quality', label: 'Call quality' },
  { href: '/admin/monitoring/registrations', label: 'Registrations' },
];
