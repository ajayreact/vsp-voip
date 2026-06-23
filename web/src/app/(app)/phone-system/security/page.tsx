'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { PhoneSystemNav } from '@/components/phone-system-nav';
import { getExtensions, getSecurityAuditLogs, getMe, isUnauthorizedError, type ExtensionAuditLog } from '@/lib/api';

export default function PhoneSystemSecurityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [extensions, setExtensions] = useState<Array<{ id: string; extensionNumber: string; displayName: string }>>([]);
  const [auditLogs, setAuditLogs] = useState<ExtensionAuditLog[]>([]);

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        return Promise.all([getExtensions(), getSecurityAuditLogs(30)]);
      })
      .then((res) => {
        if (!res) return;
        setExtensions(res[0].extensions.map((e) => ({
          id: e.id,
          extensionNumber: e.extensionNumber,
          displayName: e.displayName,
        })));
        setAuditLogs(res[1].logs);
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
        Loading security…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Security</h2>
        <p className="text-sm text-slate-400">
          Enterprise controls per extension — whitelist, blacklist, caller ID, permissions, and audit trail.
        </p>
      </div>

      <PhoneSystemNav />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Extensions</h3>
        <ul className="mt-3 divide-y divide-slate-100">
          {extensions.map((ext) => (
            <li key={ext.id} className="flex items-center justify-between py-3 text-sm">
              <span>{ext.extensionNumber} — {ext.displayName}</span>
              <Link
                href={`/phone-system/extensions/${ext.id}?tab=security`}
                className="font-medium text-indigo-600 hover:underline"
              >
                Configure security
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Recent audit activity</h3>
        {auditLogs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No audit entries yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {auditLogs.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{log.extensionNumber ?? '—'} — {log.displayName ?? 'Extension'}</span>
                  <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-slate-600">
                  <span className="capitalize">{log.category}</span>: {log.summary}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
