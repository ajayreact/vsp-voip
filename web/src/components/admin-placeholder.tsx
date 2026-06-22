import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';

export default function AdminPlaceholderPage({
  title,
  description,
  backHref = '/admin',
}: {
  title: string;
  description: string;
  backHref?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
      <div className="panel-card p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
          <Construction className="h-7 w-7" />
        </div>
        <h2 className="page-title">{title}</h2>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
        <p className="mt-4 text-xs text-slate-500">This module is on the platform roadmap.</p>
      </div>
    </div>
  );
}
