import Link from 'next/link';
import { Smartphone } from 'lucide-react';

export function BrowserCallingDisabledPanel() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <Smartphone className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Use the VSP Phone mobile app to call</h1>
      <p className="text-sm leading-relaxed text-slate-600">
        The web portal is for administration only. Outbound and inbound calls, extension dialing,
        hold, mute, transfer, and voicemail are available in the mobile app.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Back to dashboard
        </Link>
        <Link
          href="/extensions"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Manage extensions
        </Link>
      </div>
    </div>
  );
}
