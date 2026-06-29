'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Building2,
  Clock,
  CreditCard,
  Loader2,
  Phone,
  Settings2,
  Shield,
  User,
  Voicemail,
} from 'lucide-react';
import { PortalPageHeader } from '@/components/portal/page-header';
import { getMe, getTenantProfile, isUnauthorizedError } from '@/lib/api';

type SettingsSection = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  tenantAdminOnly?: boolean;
};

const SECTIONS: SettingsSection[] = [
  {
    id: 'billing',
    title: 'Billing & invoices',
    description: 'Subscription, payment history, and invoices.',
    href: '/billing',
    icon: CreditCard,
    adminOnly: true,
  },
  {
    id: 'profile',
    title: 'Company profile',
    description: 'Organization name, contact email, and timezone.',
    href: '/settings/profile',
    icon: Building2,
  },
  {
    id: 'hours',
    title: 'Business hours',
    description: 'After-hours routing and schedule for inbound calls.',
    href: '/greeting',
    icon: Clock,
    adminOnly: true,
  },
  {
    id: 'caller-id',
    title: 'Caller ID',
    description: 'Outbound caller ID and display name per extension.',
    href: '/extensions',
    icon: Phone,
    adminOnly: true,
  },
  {
    id: 'voicemail',
    title: 'Voicemail defaults',
    description: 'Tenant voicemail prompts, length limits, and after-hours behavior.',
    href: '/greeting',
    icon: Voicemail,
    adminOnly: true,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Voicemail email notifications and extension notification settings.',
    href: '/extensions',
    icon: Bell,
    adminOnly: true,
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Extension whitelist, blacklist, permissions, and audit activity.',
    href: '/extensions',
    icon: Shield,
    adminOnly: true,
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'Danger zone and administrative PBX configuration controls.',
    href: '/settings/advanced',
    icon: Settings2,
    tenantAdminOnly: true,
  },
  {
    id: 'preferences',
    title: 'User preferences',
    description: 'Your account profile and contact details.',
    href: '/settings/profile',
    icon: User,
  },
];

export function SettingsHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | undefined>();
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setRole(user.role);
        return getTenantProfile().catch(() => null);
      })
      .then((res) => {
        if (res?.profile?.name) setCompanyName(res.profile.name);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const isAdmin = role === 'TENANT_ADMIN' || role === 'SUPER_ADMIN';
  const visible = SECTIONS.filter((section) => {
    if (section.tenantAdminOnly) return role === 'TENANT_ADMIN';
    if (section.adminOnly) return isAdmin;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title="Settings"
        description={
          companyName
            ? `${companyName} — organization configuration and preferences.`
            : 'Organization configuration and preferences.'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.id}
              href={section.href}
              className="panel-card block p-5 transition hover:border-indigo-200 hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-indigo-50 p-2">
                  <Icon className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">{section.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {isAdmin ? (
        <p className="text-sm text-slate-500">
          Call routing, IVR, and recording defaults are managed under{' '}
          <Link href="/greeting" className="text-indigo-600 hover:text-indigo-700">
            Call routing
          </Link>
          . Billing is under{' '}
          <Link href="/billing" className="text-indigo-600 hover:text-indigo-700">
            Billing
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
