'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ExtensionDetailRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = String(params?.id || '');
    if (!id) {
      router.replace('/phone-system/extensions');
      return;
    }
    if (id === 'new') {
      router.replace('/phone-system/extensions?create=1');
      return;
    }
    const tab = searchParams.get('tab') || 'overview';
    const mode = searchParams.get('edit') === '1' ? '&mode=edit' : '';
    router.replace(`/phone-system/extensions?open=${id}&tab=${tab}${mode}`);
  }, [params?.id, router, searchParams]);

  return (
    <div className="flex items-center justify-center py-24 text-slate-400">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      Opening extension…
    </div>
  );
}
