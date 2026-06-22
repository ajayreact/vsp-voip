'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Shield, ArrowLeftRight } from 'lucide-react';

export function AdminPageHeader({
  title,
  subtitle,
  section,
}: {
  title: string;
  subtitle?: string;
  section?: string;
}) {
  const pathname = usePathname();
  const onAdminRoute = pathname.startsWith('/admin');

  return (
    <div className="mb-6">
      {section ? (
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-600">{section}</p>
      ) : null}
      <h2 className="page-title">{title}</h2>
      {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      {onAdminRoute ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Shield className="h-3.5 w-3.5 text-indigo-500" />
          Platform admin
        </div>
      ) : null}
    </div>
  );
}

export function AdminTenantSwitchLink({ hasTenant }: { hasTenant?: boolean }) {
  if (!hasTenant) return null;
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      <ArrowLeftRight className="h-3.5 w-3.5" />
      Switch to tenant portal
    </Link>
  );
}
