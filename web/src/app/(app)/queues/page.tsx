'use client';

import { useEffect, useState } from 'react';
import { PbxManager, parseJsonArray } from '@/components/v3/pbx/pbx-manager';
import { getV3PbxReferences, v3QueuesApi, type PbxExtensionRef } from '@/lib/v3-api';

function resolveMemberIds(raw: string, extensions: PbxExtensionRef[]): string[] {
  const tokens = parseJsonArray(raw);
  return tokens.map((token) => {
    const byId = extensions.find((e) => e.id === token);
    if (byId) return byId.id;
    const byNumber = extensions.find((e) => e.extensionNumber === token);
    return byNumber?.id || null;
  }).filter((id): id is string => Boolean(id));
}

function membersToRaw(ids: string[] | undefined, extensions: PbxExtensionRef[]): string {
  if (!ids?.length) return '';
  return ids.map((id) => {
    const ext = extensions.find((e) => e.id === id);
    return ext?.extensionNumber || id;
  }).join(', ');
}

export default function QueuesPage() {
  const [extensions, setExtensions] = useState<PbxExtensionRef[]>([]);

  useEffect(() => {
    getV3PbxReferences()
      .then((res) => setExtensions(res.extensions || []))
      .catch(() => setExtensions([]));
  }, []);

  function toPayload(form: Record<string, unknown>) {
    const members = form.membersRaw
      ? resolveMemberIds(String(form.membersRaw), extensions)
      : (Array.isArray(form.memberExtensionIds) ? form.memberExtensionIds as string[] : []);
    return {
      name: form.name,
      extensionNumber: form.extensionNumber || null,
      strategy: form.strategy || 'LONGEST_IDLE',
      memberExtensionIds: members,
      maxWaitSeconds: Number(form.maxWaitSeconds) || 300,
      isActive: form.isActive !== false,
    };
  }

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
        { key: 'membersRaw', label: 'Member Extensions (numbers, comma-separated)', placeholder: '101, 102' },
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
      mapItemToForm={(item) => ({
        name: item.name || '',
        extensionNumber: item.extensionNumber || '',
        strategy: item.strategy || 'LONGEST_IDLE',
        membersRaw: membersToRaw(item.memberExtensionIds as string[] | undefined, extensions),
        maxWaitSeconds: item.maxWaitSeconds ?? 300,
        isActive: item.isActive !== false,
      })}
    />
  );
}
