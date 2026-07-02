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
  Sparkles,
  ShoppingCart,
  HeartPulse,
  UserPlus,
  Store,
  Link2,
  MonitorSmartphone,
  Activity,
  Settings2,
  GitBranch,
  Wrench,
  Play,
  Clock,
  Calendar,
} from 'lucide-react';

/** Tenant Portal V3 preview — inlined at build time from NEXT_PUBLIC_V3_PORTAL. */
function isV3PortalNavEnabled(): boolean {
  const value = (process.env.NEXT_PUBLIC_V3_PORTAL || '').toLowerCase();
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

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
  const sections: PortalNavSection[] = [
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
      id: 'ai',
      label: 'AI',
      items: [
        { href: '/assistant', label: 'Enterprise Assistant', icon: Sparkles, matchPrefix: '/assistant' },
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

  if (isV3PortalNavEnabled()) {
    sections.push({
      id: 'v3',
      label: 'V3 Preview',
      items: [
        { href: '/v3/health', label: 'Health Center', icon: HeartPulse, matchPrefix: '/v3/health', adminOnly: true },
        { href: '/v3/employees', label: 'Employees (V3)', icon: UserPlus, matchPrefix: '/v3/employees', adminOnly: true },
        { href: '/v3/numbers', label: 'Number Inventory', icon: Hash, matchPrefix: '/v3/numbers', adminOnly: true },
        { href: '/v3/marketplace', label: 'Marketplace', icon: Store, matchPrefix: '/v3/marketplace', adminOnly: true },
        { href: '/v3/assignments', label: 'Assignments', icon: Link2, matchPrefix: '/v3/assignments', adminOnly: true },
        { href: '/v3/devices', label: 'Desk Phones', icon: MonitorSmartphone, matchPrefix: '/v3/devices', adminOnly: true },
        { href: '/v3/device-health', label: 'Device Health', icon: Activity, matchPrefix: '/v3/device-health', adminOnly: true },
        { href: '/v3/device-provision', label: 'Device Provision', icon: Settings2, matchPrefix: '/v3/device-provision', adminOnly: true },
        { href: '/v3/callflows', label: 'Call Flows', icon: GitBranch, matchPrefix: '/v3/callflows', adminOnly: true },
        { href: '/v3/callflows/builder', label: 'Flow Builder', icon: Wrench, matchPrefix: '/v3/callflows/builder', adminOnly: true },
        { href: '/v3/callflows/simulator', label: 'Flow Simulator', icon: Play, matchPrefix: '/v3/callflows/simulator', adminOnly: true },
        { href: '/v3/ring-groups', label: 'Ring Groups', icon: UsersRound, matchPrefix: '/v3/ring-groups', adminOnly: true },
        { href: '/v3/queues', label: 'Queues', icon: Hash, matchPrefix: '/v3/queues', adminOnly: true },
        { href: '/v3/business-hours', label: 'Business Hours', icon: Clock, matchPrefix: '/v3/business-hours', adminOnly: true },
        { href: '/v3/holidays', label: 'Holidays', icon: Calendar, matchPrefix: '/v3/holidays', adminOnly: true },
        { href: '/v3/voicemail', label: 'Voicemail', icon: Voicemail, matchPrefix: '/v3/voicemail', adminOnly: true },
      ],
    });
  }

  return sections;
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
