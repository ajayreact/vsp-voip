'use client';

import Link from 'next/link';
import { PhoneSystemNav } from '@/components/phone-system-nav';

export default function PhoneSystemCallRoutingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Call routing</h2>
        <p className="text-sm text-slate-400">
          Business hours, ring groups, IVR, and after-hours behavior.
        </p>
      </div>

      <PhoneSystemNav />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">
          Call routing is configured at the organization level. Extensions identify people and queues; routing rules decide how inbound calls flow.
        </p>
        <Link
          href="/greeting"
          className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Open call routing settings
        </Link>
      </div>
    </div>
  );
}
