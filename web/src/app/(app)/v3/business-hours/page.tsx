'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PbxManager } from '@/components/v3/pbx/pbx-manager';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { isV3PortalEnabled, v3BusinessHoursApi } from '@/lib/v3-api';

function toPayload(form: Record<string, unknown>) {
  let weekdays = {};
  let weekends = {};
  try { weekdays = JSON.parse(String(form.weekdaysJson || '{}')); } catch { /* keep default */ }
  try { weekends = JSON.parse(String(form.weekendsJson || '{}')); } catch { /* keep default */ }
  return {
    name: form.name,
    timezone: form.timezone || 'America/New_York',
    weekdays,
    weekends,
    isDefault: Boolean(form.isDefault),
  };
}

export default function V3BusinessHoursPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isV3PortalEnabled()) router.replace('/dashboard');
    else getMe().catch((e) => { if (isUnauthorizedError(e)) router.replace('/login'); });
  }, [router]);

  return (
    <PbxManager
      title="Business Hours"
      description="Multiple schedules per tenant for Call Flow Builder time conditions."
      nameKey="name"
      fields={[
        { key: 'name', label: 'Schedule Name' },
        { key: 'timezone', label: 'Time Zone', placeholder: 'America/New_York' },
        { key: 'weekdaysJson', label: 'Weekdays (JSON)', type: 'textarea', placeholder: '{"mon":["09:00","17:00"]}' },
        { key: 'weekendsJson', label: 'Weekends (JSON)', type: 'textarea', placeholder: '{"sat":["10:00","14:00"]}' },
        { key: 'isDefault', label: 'Default Schedule', type: 'checkbox' },
      ]}
      emptyForm={{ name: '', timezone: 'America/New_York', weekdaysJson: '{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"]}', weekendsJson: '{}', isDefault: false }}
      listItems={(s) => v3BusinessHoursApi.list(s).then((r) => ({ items: r.items as { id: string }[] }))}
      createItem={(f) => v3BusinessHoursApi.create(toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      updateItem={(id, f) => v3BusinessHoursApi.update(id, toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      deleteItem={(id) => v3BusinessHoursApi.delete(id)}
      validateItem={(f) => v3BusinessHoursApi.validate(toPayload(f))}
      formatRow={(item) => String(item.timezone)}
    />
  );
}
