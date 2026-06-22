'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NewExtensionRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/phone-system/extensions?create=1');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-24 text-slate-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Opening add extension…
    </div>
  );
}
