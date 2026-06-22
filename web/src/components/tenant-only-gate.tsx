'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMe, type User } from '@/lib/api';

type TenantOnlyGateProps = {
  children: React.ReactNode;
  featureName: string;
};

export function TenantOnlyGate({ children, featureName }: TenantOnlyGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-24 text-center text-slate-400">Loading…</div>;
  }

  if (user?.role === 'SUPER_ADMIN' && !user.tenantId) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-lg font-medium text-amber-900">
          {featureName} is for tenant accounts
        </h2>
        <p className="text-sm text-amber-900/90">
          Your super admin account manages the whole platform, not a single organization.
          Tenant features like softphone, SMS, voicemail, and recordings require a tenant login.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/admin" className="text-indigo-600 hover:text-indigo-500">
            Admin overview →
          </Link>
          <Link href="/admin/tenants" className="text-indigo-600 hover:text-indigo-500">
            Manage tenants →
          </Link>
        </div>
        <p className="text-xs text-slate-400">
          To test {featureName.toLowerCase()}, sign in as a tenant admin (e.g. admin@asuitech.com / Admin@123).
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function useTenantUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  return {
    user,
    loading,
    isSuperAdminWithoutTenant: user?.role === 'SUPER_ADMIN' && !user.tenantId,
  };
}
