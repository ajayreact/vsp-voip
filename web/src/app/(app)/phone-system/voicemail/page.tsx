'use client';

import Link from 'next/link';
import { PhoneSystemNav } from '@/components/phone-system-nav';

export default function PhoneSystemVoicemailPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Voicemail</h2>
        <p className="text-sm text-slate-400">
          Organization-wide voicemail inbox and per-extension messages.
        </p>
      </div>

      <PhoneSystemNav />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          View all voicemails in the main inbox, or open an extension to see messages for its assigned numbers.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/voicemail"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Open voicemail inbox
          </Link>
          <Link
            href="/phone-system/extensions"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Browse extensions
          </Link>
        </div>
      </div>
    </div>
  );
}
