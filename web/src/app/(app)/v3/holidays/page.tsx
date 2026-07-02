'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PbxManager } from '@/components/v3/pbx/pbx-manager';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { isV3PortalEnabled, v3HolidaysApi } from '@/lib/v3-api';

function toPayload(form: Record<string, unknown>) {
  return {
    name: form.name,
    date: form.date,
    recurring: Boolean(form.recurring),
    oneTime: form.oneTime !== false,
  };
}

export default function V3HolidaysPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isV3PortalEnabled()) router.replace('/dashboard');
    else getMe().catch((e) => { if (isUnauthorizedError(e)) router.replace('/login'); });
  }, [router]);

  return (
    <PbxManager
      title="Holiday Calendar"
      description="Holiday entries with optional override destinations for Call Flow Builder."
      nameKey="name"
      fields={[
        { key: 'name', label: 'Holiday Name' },
        { key: 'date', label: 'Date (YYYY-MM-DD or MM-DD)', placeholder: '2026-12-25' },
        { key: 'recurring', label: 'Recurring annually', type: 'checkbox' },
        { key: 'oneTime', label: 'One-time', type: 'checkbox' },
      ]}
      emptyForm={{ name: '', date: '', recurring: false, oneTime: true }}
      listItems={(s) => v3HolidaysApi.list(s).then((r) => ({ items: r.items as { id: string }[] }))}
      createItem={(f) => v3HolidaysApi.create(toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      updateItem={(id, f) => v3HolidaysApi.update(id, toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      deleteItem={(id) => v3HolidaysApi.delete(id)}
      validateItem={(f) => v3HolidaysApi.validate(toPayload(f))}
      formatRow={(item) => String(item.date)}
    />
  );
}
