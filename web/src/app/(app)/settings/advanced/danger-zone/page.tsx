'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { ResetPbxConfigurationPanel } from '@/components/portal/reset-pbx-configuration-panel';
import { SettingsNav } from '@/components/settings-nav';
import { getMe, isUnauthorizedError } from '@/lib/api';

export default function DangerZoneSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        if (user.role !== 'TENANT_ADMIN') {
          router.replace('/settings');
          return;
        }
        setRole(user.role);
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading danger zone…
      </div>
    );
  }

  if (role !== 'TENANT_ADMIN') {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/settings/advanced"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Advanced
        </Link>
        <h2 className="text-lg font-medium text-slate-900">Danger Zone</h2>
        <p className="text-sm text-slate-400">
          Settings → Advanced → Danger Zone
        </p>
      </div>

      <SettingsNav role={role} />

      <ResetPbxConfigurationPanel />
    </div>
  );
}
