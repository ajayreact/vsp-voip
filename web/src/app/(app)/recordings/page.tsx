import { Suspense } from 'react';
import { RecordingsManagerPage } from '@/components/portal/recordings-manager';

export default function RecordingsPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-slate-400">Loading recordings…</div>}>
      <RecordingsManagerPage />
    </Suspense>
  );
}
