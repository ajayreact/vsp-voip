'use client';

import { PbxManager } from '@/components/v3/pbx/pbx-manager';
import { v3HolidaysApi } from '@/lib/v3-api';

function toPayload(form: Record<string, unknown>) {
  return {
    name: form.name,
    date: form.date,
    isClosed: form.isClosed !== false,
    openTime: form.openTime || null,
    closeTime: form.closeTime || null,
  };
}

export default function HolidaysPage() {
  return (
    <PbxManager
      title="Holidays"
      description="Holiday schedules for Call Flow Builder time conditions."
      nameKey="name"
      fields={[
        { key: 'name', label: 'Holiday Name' },
        { key: 'date', label: 'Date (YYYY-MM-DD)' },
        { key: 'isClosed', label: 'Closed All Day', type: 'checkbox' },
        { key: 'openTime', label: 'Open Time (optional)', placeholder: '09:00' },
        { key: 'closeTime', label: 'Close Time (optional)', placeholder: '13:00' },
      ]}
      emptyForm={{ name: '', date: '', isClosed: true, openTime: '', closeTime: '' }}
      listItems={(s) => v3HolidaysApi.list(s).then((r) => ({ items: r.items as { id: string }[] }))}
      createItem={(f) => v3HolidaysApi.create(toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      updateItem={(id, f) => v3HolidaysApi.update(id, toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      deleteItem={(id) => v3HolidaysApi.delete(id)}
      validateItem={(f) => v3HolidaysApi.validate(toPayload(f))}
      formatRow={(item) => String(item.date)}
    />
  );
}
