'use client';

import { useEffect, useState } from 'react';
import { PbxManager, parseJsonArray } from '@/components/v3/pbx/pbx-manager';
import { getV3PbxReferences, v3RingGroupsApi, type PbxExtensionRef } from '@/lib/v3-api';

const STRATEGIES = [
  { value: 'SEQUENTIAL', label: 'Sequential' },
  { value: 'SIMULTANEOUS', label: 'Simultaneous' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'LONGEST_IDLE', label: 'Longest Idle' },
  { value: 'RANDOM', label: 'Random' },
];

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

export default function RingGroupsPage() {
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
      strategy: form.strategy || 'SIMULTANEOUS',
      memberExtensionIds: members,
      ringTimeoutSeconds: Number(form.ringTimeoutSeconds) || 25,
      isActive: form.isActive !== false,
    };
  }

  return (
    <PbxManager
      title="Ring Groups"
      description="Configure ring groups for Call Flow Builder — not connected to live routing yet."
      nameKey="name"
      fields={[
        { key: 'name', label: 'Group Name' },
        { key: 'extensionNumber', label: 'Extension Number' },
        { key: 'strategy', label: 'Strategy', type: 'select', options: STRATEGIES },
        { key: 'membersRaw', label: 'Member Extensions (numbers, comma-separated)', placeholder: '101, 102' },
        { key: 'ringTimeoutSeconds', label: 'Ring Timeout (sec)', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'checkbox' },
      ]}
      emptyForm={{ name: '', strategy: 'SIMULTANEOUS', ringTimeoutSeconds: 25, membersRaw: '', isActive: true }}
      listItems={(s) => v3RingGroupsApi.list(s).then((r) => ({ items: r.items as { id: string }[] }))}
      createItem={(f) => v3RingGroupsApi.create(toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      updateItem={(id, f) => v3RingGroupsApi.update(id, toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      deleteItem={(id) => v3RingGroupsApi.delete(id)}
      validateItem={(f) => v3RingGroupsApi.validate(toPayload(f))}
      formatRow={(item) => `${item.strategy} · ${(item.memberExtensionIds as string[])?.length || 0} members`}
      mapItemToForm={(item) => ({
        name: item.name || '',
        extensionNumber: item.extensionNumber || '',
        strategy: item.strategy || 'SIMULTANEOUS',
        membersRaw: membersToRaw(item.memberExtensionIds as string[] | undefined, extensions),
        ringTimeoutSeconds: item.ringTimeoutSeconds ?? 25,
        isActive: item.isActive !== false,
      })}
    />
  );
}
