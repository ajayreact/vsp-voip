import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Phone,
  Hash,
  Smartphone,
  UsersRound,
  History,
  Mic,
  Voicemail,
  BarChart3,
  CreditCard,
  Settings,
  MessagesSquare,
  ShoppingCart,
} from 'lucide-react';

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match prefix for active state (defaults to href) */
  matchPrefix?: string;
  badgeKey?: 'voicemail' | 'sms' | 'cart';
  adminOnly?: boolean;
};

export type PortalNavSection = {
  id: string;
  label: string;
  items: PortalNavItem[];
};

/** Canonical tenant portal navigation (Phase 2.7). */
export function buildPortalNavSections(): PortalNavSection[] {
  return [
    {
      id: 'overview',
      label: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
    },
    {
      id: 'pbx',
      label: 'Phone System',
      items: [
        { href: '/employees', label: 'Employees', icon: Users, adminOnly: true },
        {
          href: '/extensions',
          label: 'Extensions',
          icon: Phone,
          matchPrefix: '/extensions',
        },
        {
          href: '/phone-numbers',
          label: 'Phone Numbers',
          icon: Hash,
          matchPrefix: '/phone-numbers',
        },
        {
          href: '/devices',
          label: 'Devices',
          icon: Smartphone,
          matchPrefix: '/devices',
        },
        {
          href: '/ring-groups',
          label: 'Ring Groups',
          icon: UsersRound,
          matchPrefix: '/ring-groups',
        },
      ],
    },
    {
      id: 'communications',
      label: 'Communications',
      items: [
        { href: '/calls', label: 'Call History', icon: History, matchPrefix: '/calls' },
        { href: '/recordings', label: 'Recordings', icon: Mic, matchPrefix: '/recordings' },
        { href: '/voicemail', label: 'Voicemail', icon: Voicemail, matchPrefix: '/voicemail', badgeKey: 'voicemail' },
        { href: '/sms', label: 'Messages', icon: MessagesSquare, matchPrefix: '/sms', badgeKey: 'sms' },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        { href: '/reports', label: 'Reports', icon: BarChart3, matchPrefix: '/reports' },
        { href: '/billing', label: 'Billing', icon: CreditCard, matchPrefix: '/billing' },
        { href: '/settings', label: 'Settings', icon: Settings, matchPrefix: '/settings' },
        { href: '/numbers', label: 'Buy Numbers', icon: ShoppingCart, matchPrefix: '/numbers' },
        { href: '/cart', label: 'Cart', icon: ShoppingCart, matchPrefix: '/cart', badgeKey: 'cart' },
      ],
    },
  ];
}

export function isPortalNavActive(pathname: string, item: PortalNavItem): boolean {
  const prefix = item.matchPrefix || item.href;
  if (prefix === '/dashboard') return pathname === '/dashboard';
  if (prefix === '/settings') {
    return pathname === '/settings' || pathname.startsWith('/settings/');
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Legacy paths → canonical Phase 2.7 routes */
export const PORTAL_ROUTE_ALIASES: Record<string, string> = {
  '/phone-system/extensions': '/extensions',
  '/phone-system/devices': '/devices',
  '/phone-system/ring-groups': '/ring-groups',
  '/my-numbers': '/phone-numbers',
  '/settings/team': '/employees',
};
