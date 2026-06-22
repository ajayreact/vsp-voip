'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminPaymentsNav } from '@/components/admin-payments-nav';
import { AdminPlatformSettingsForm } from '@/components/admin-platform-settings-form';

export default function AdminBankPaymentsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <h2 className="text-lg font-medium text-slate-900">Payments</h2>
        <p className="text-sm text-slate-400">Bank transfer details shown on manual invoices to tenants.</p>
      </div>

      <AdminPaymentsNav />
      <AdminPlatformSettingsForm sections={['bank']} saveLabel="Save bank account settings" />
    </div>
  );
}
