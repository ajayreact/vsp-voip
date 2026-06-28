'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  Hash,
  DollarSign,
  CreditCard,
  Activity,
  LifeBuoy,
  Settings2,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export const superAdminSections: NavSection[] = [
  {
    title: 'Dashboard',
    items: [
      { href: '/admin', label: 'Executive', icon: LayoutDashboard, exact: true },
      { href: '/admin/operations', label: 'Live operations', icon: Radio },
    ],
  },
  {
    title: 'Tenants',
    items: [
      { href: '/admin/tenants', label: 'Tenant directory', icon: Building2 },
      { href: '/admin/tenants/usage', label: 'Usage monitoring', icon: Activity },
      { href: '/admin/tenants/quotas', label: 'Resource quotas', icon: Building2 },
    ],
  },
  {
    title: 'Numbers',
    items: [
      { href: '/admin/numbers', label: 'Number inventory', icon: Hash },
      { href: '/admin/numbers/purchase', label: 'Search & buy numbers', icon: Hash },
      { href: '/admin/numbers/porting', label: 'Number porting', icon: Hash },
      { href: '/admin/numbers/history', label: 'Purchase history', icon: Hash },
    ],
  },
  {
    title: 'Billing',
    items: [
      { href: '/admin/billing', label: 'Overview', icon: DollarSign, exact: true },
      { href: '/admin/billing/orders', label: 'Orders & invoices', icon: DollarSign },
      { href: '/admin/billing/payment-gateways', label: 'Payment gateways', icon: CreditCard },
      { href: '/admin/billing/revenue', label: 'Revenue analytics', icon: DollarSign },
      { href: '/admin/billing/revenue-protection', label: 'Revenue protection', icon: DollarSign },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { href: '/admin/monitoring/telephony-health', label: 'Telephony health', icon: Radio },
      { href: '/admin/monitoring/quality', label: 'Call quality', icon: Activity },
      { href: '/admin/monitoring/registrations', label: 'Registrations', icon: Radio },
    ],
  },
  {
    title: 'Support',
    items: [
      { href: '/admin/support/users', label: 'User management', icon: Building2 },
      { href: '/admin/support/audit', label: 'Audit logs', icon: LifeBuoy },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/admin/settings/platform', label: 'Platform', icon: Settings2 },
      { href: '/admin/settings/carrier', label: 'Carrier', icon: Settings2 },
      { href: '/admin/settings/billing', label: 'Billing', icon: Settings2 },
      { href: '/admin/settings/security', label: 'Security', icon: Settings2 },
    ],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact || href === '/admin') return pathname === href;
  if (href === '/admin/tenants') {
    return pathname === '/admin/tenants' || /^\/admin\/tenants\/[^/]+$/.test(pathname);
  }
  if (href === '/admin/billing') {
    return pathname === '/admin/billing';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="space-y-5">
      {superAdminSections.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={`${section.title}-${item.label}`}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition',
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
