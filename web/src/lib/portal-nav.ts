import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Hash,
  UsersRound,
  Voicemail,
  BarChart3,
  CreditCard,
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
  UserCircle,
  SlidersHorizontal,
  BookUser,
  Radio,
  Bell,
  FileText,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Server,
  Gauge,
  Stethoscope,
  Shield,
  ArrowRightLeft,
  FlaskConical,
} from 'lucide-react';

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match prefix for active state (defaults to href) */
  matchPrefix?: string;
  /** Tenant admin or super admin */
  adminOnly?: boolean;
  /** Super admin only (platform ops) */
  superAdminOnly?: boolean;
};

export type PortalNavSection = {
  id: string;
  label: string;
  items: PortalNavItem[];
};

/** Tenant portal navigation — V3 is the only supported portal. */
export function buildPortalNavSections(): PortalNavSection[] {
  return [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/health', label: 'Health Center', icon: HeartPulse, matchPrefix: '/health', adminOnly: true },
        { href: '/analytics', label: 'Analytics', icon: BarChart3, matchPrefix: '/analytics', adminOnly: true },
        { href: '/reports', label: 'Reports', icon: FileText, matchPrefix: '/reports', adminOnly: true },
        { href: '/activity', label: 'Activity', icon: Activity, matchPrefix: '/activity', adminOnly: true },
        { href: '/notifications', label: 'Notifications', icon: Bell, matchPrefix: '/notifications', adminOnly: true },
        { href: '/system-health', label: 'System Health', icon: Activity, matchPrefix: '/system-health', adminOnly: true },
      ],
    },
    {
      id: 'pbx',
      label: 'Phone System',
      items: [
        { href: '/employees', label: 'Employees', icon: UserPlus, matchPrefix: '/employees', adminOnly: true },
        { href: '/numbers', label: 'Number Inventory', icon: Hash, matchPrefix: '/numbers', adminOnly: true },
        { href: '/assignments', label: 'Assignments', icon: Link2, matchPrefix: '/assignments', adminOnly: true },
        { href: '/devices', label: 'Desk Phones', icon: MonitorSmartphone, matchPrefix: '/devices', adminOnly: true },
        { href: '/device-health', label: 'Device Health', icon: Activity, matchPrefix: '/device-health', adminOnly: true },
        { href: '/device-provision', label: 'Device Provision', icon: Settings2, matchPrefix: '/device-provision', adminOnly: true },
        { href: '/callflows', label: 'Call Flows', icon: GitBranch, matchPrefix: '/callflows', adminOnly: true },
        { href: '/callflows/builder', label: 'Flow Builder', icon: Wrench, matchPrefix: '/callflows/builder', adminOnly: true },
        { href: '/callflows/simulator', label: 'Flow Simulator', icon: Play, matchPrefix: '/callflows/simulator', adminOnly: true },
        { href: '/ring-groups', label: 'Ring Groups', icon: UsersRound, matchPrefix: '/ring-groups', adminOnly: true },
        { href: '/queues', label: 'Queues', icon: Hash, matchPrefix: '/queues', adminOnly: true },
        { href: '/business-hours', label: 'Business Hours', icon: Clock, matchPrefix: '/business-hours', adminOnly: true },
        { href: '/holidays', label: 'Holidays', icon: Calendar, matchPrefix: '/holidays', adminOnly: true },
        { href: '/voicemail', label: 'Voicemail', icon: Voicemail, matchPrefix: '/voicemail', adminOnly: true },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        { href: '/billing', label: 'Billing', icon: CreditCard, matchPrefix: '/billing', adminOnly: true },
        { href: '/subscription', label: 'Subscription', icon: CreditCard, matchPrefix: '/subscription', adminOnly: true },
        { href: '/license', label: 'License', icon: ShieldCheck, matchPrefix: '/license', adminOnly: true },
        { href: '/backups', label: 'Backups', icon: HardDrive, matchPrefix: '/backups', adminOnly: true },
        { href: '/import-export', label: 'Import / Export', icon: FileText, matchPrefix: '/import-export', adminOnly: true },
        { href: '/lifecycle', label: 'Lifecycle', icon: RefreshCw, matchPrefix: '/lifecycle', adminOnly: true },
        { href: '/profile', label: 'My Profile', icon: UserCircle, matchPrefix: '/profile' },
        { href: '/preferences', label: 'Preferences', icon: SlidersHorizontal, matchPrefix: '/preferences' },
        { href: '/directory', label: 'Directory', icon: BookUser, matchPrefix: '/directory' },
        { href: '/presence', label: 'Presence', icon: Radio, matchPrefix: '/presence' },
        { href: '/marketplace', label: 'Marketplace', icon: Store, matchPrefix: '/marketplace', superAdminOnly: true },
      ],
    },
    {
      id: 'ops',
      label: 'Operations',
      items: [
        { href: '/runtime', label: 'Runtime Sync', icon: Server, matchPrefix: '/runtime', adminOnly: true },
        { href: '/production-health', label: 'Production Health', icon: Shield, matchPrefix: '/production-health', adminOnly: true },
        { href: '/monitoring', label: 'Monitoring', icon: Activity, matchPrefix: '/monitoring', adminOnly: true },
        { href: '/metrics', label: 'Metrics', icon: Gauge, matchPrefix: '/metrics', adminOnly: true },
        { href: '/diagnostics', label: 'Diagnostics', icon: Stethoscope, matchPrefix: '/diagnostics', adminOnly: true },
        { href: '/runtime-validation', label: 'Runtime Validation', icon: ShieldCheck, matchPrefix: '/runtime-validation', adminOnly: true },
        { href: '/migration', label: 'Migration', icon: ArrowRightLeft, matchPrefix: '/migration', adminOnly: true },
        { href: '/migration-wizard', label: 'Migration Wizard', icon: ArrowRightLeft, matchPrefix: '/migration-wizard', superAdminOnly: true },
        { href: '/test-lab', label: 'Test Lab', icon: FlaskConical, matchPrefix: '/test-lab', superAdminOnly: true },
      ],
    },
  ];
}

export function isPortalNavActive(pathname: string, item: PortalNavItem): boolean {
  const prefix = item.matchPrefix || item.href;
  if (prefix === '/dashboard') return pathname === '/dashboard';
  if (prefix === '/profile') {
    return pathname === '/profile' || pathname.startsWith('/settings/');
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Legacy paths → canonical routes */
export const PORTAL_ROUTE_ALIASES: Record<string, string> = {
  '/phone-system/extensions': '/employees',
  '/phone-system/devices': '/devices',
  '/phone-system/ring-groups': '/ring-groups',
  '/my-numbers': '/numbers',
  '/phone-numbers': '/numbers',
  '/settings/team': '/employees',
  '/settings': '/profile',
  '/settings/profile': '/profile',
  '/extensions': '/employees',
  '/cart': '/marketplace',
  '/numbers/buy': '/marketplace',
};
