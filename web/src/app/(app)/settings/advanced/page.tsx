'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { SettingsNav } from '@/components/settings-nav';
import { getMe, isUnauthorizedError } from '@/lib/api';

export default function AdvancedSettingsPage() {
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
        Loading advanced settings…
      </div>
    );
  }

  if (role !== 'TENANT_ADMIN') {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Settings</h2>
        <p className="text-sm text-slate-400">Advanced organization controls</p>
      </div>

      <SettingsNav role={role} />

      <div className="panel-card p-6">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-indigo-400" />
          <h3 className="font-medium text-slate-900">Advanced</h3>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Administrative actions that affect your company PBX configuration.
        </p>
      </div>

      <Link
        href="/settings/advanced/danger-zone"
        className="panel-card flex items-center justify-between p-5 transition hover:border-red-200 hover:shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-medium text-slate-900">Danger Zone</h3>
            <p className="mt-1 text-sm text-slate-500">
              Irreversible PBX configuration actions for your company only.
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </Link>
    </div>
  );
}
