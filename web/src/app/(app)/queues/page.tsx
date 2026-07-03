'use client';

import { PbxManager, parseJsonArray } from '@/components/v3/pbx/pbx-manager';
import { v3QueuesApi } from '@/lib/v3-api';

function toPayload(form: Record<string, unknown>) {
  const members = form.membersRaw
    ? parseJsonArray(String(form.membersRaw))
    : (Array.isArray(form.memberExtensionIds) ? form.memberExtensionIds : []);
  return {
    name: form.name,
    extensionNumber: form.extensionNumber || null,
    strategy: form.strategy || 'LONGEST_IDLE',
    memberExtensionIds: members,
    maxWaitSeconds: Number(form.maxWaitSeconds) || 300,
    isActive: form.isActive !== false,
  };
}

export default function QueuesPage() {
  return (
    <PbxManager
      title="Queues"
      description="Configure call queues for Call Flow Builder — not connected to live routing yet."
      nameKey="name"
      fields={[
        { key: 'name', label: 'Queue Name' },
        { key: 'extensionNumber', label: 'Extension Number' },
        { key: 'strategy', label: 'Strategy', type: 'select', options: [
          { value: 'LONGEST_IDLE', label: 'Longest Idle' },
          { value: 'ROUND_ROBIN', label: 'Round Robin' },
          { value: 'RANDOM', label: 'Random' },
        ]},
        { key: 'membersRaw', label: 'Member Extension IDs (comma-separated)', placeholder: 'ext-id-1, ext-id-2' },
        { key: 'maxWaitSeconds', label: 'Max Wait (sec)', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'checkbox' },
      ]}
      emptyForm={{ name: '', strategy: 'LONGEST_IDLE', maxWaitSeconds: 300, membersRaw: '', isActive: true }}
      listItems={(s) => v3QueuesApi.list(s).then((r) => ({ items: r.items as { id: string }[] }))}
      createItem={(f) => v3QueuesApi.create(toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      updateItem={(id, f) => v3QueuesApi.update(id, toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      deleteItem={(id) => v3QueuesApi.delete(id)}
      validateItem={(f) => v3QueuesApi.validate(toPayload(f))}
      formatRow={(item) => `${item.strategy} · ${(item.memberExtensionIds as string[])?.length || 0} members`}
    />
  );
}
