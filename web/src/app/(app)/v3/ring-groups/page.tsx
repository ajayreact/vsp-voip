'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PbxManager, parseJsonArray } from '@/components/v3/pbx/pbx-manager';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { isV3PortalEnabled, v3RingGroupsApi } from '@/lib/v3-api';

const STRATEGIES = [
  { value: 'SEQUENTIAL', label: 'Sequential' },
  { value: 'SIMULTANEOUS', label: 'Simultaneous' },
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'LONGEST_IDLE', label: 'Longest Idle' },
  { value: 'RANDOM', label: 'Random' },
];

function toPayload(form: Record<string, unknown>) {
  const members = form.membersRaw
    ? parseJsonArray(String(form.membersRaw))
    : (Array.isArray(form.memberExtensionIds) ? form.memberExtensionIds : []);
  return {
    name: form.name,
    extensionNumber: form.extensionNumber || null,
    strategy: form.strategy || 'SIMULTANEOUS',
    memberExtensionIds: members,
    ringTimeoutSeconds: Number(form.ringTimeoutSeconds) || 25,
    isActive: form.isActive !== false,
  };
}

export default function V3RingGroupsPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isV3PortalEnabled()) router.replace('/dashboard');
    else getMe().catch((e) => { if (isUnauthorizedError(e)) router.replace('/login'); });
  }, [router]);

  return (
    <PbxManager
      title="Ring Groups"
      description="Configure ring groups for Call Flow Builder — not connected to live routing yet."
      nameKey="name"
      fields={[
        { key: 'name', label: 'Group Name' },
        { key: 'extensionNumber', label: 'Extension Number' },
        { key: 'strategy', label: 'Strategy', type: 'select', options: STRATEGIES },
        { key: 'membersRaw', label: 'Member Extension IDs (comma-separated)', placeholder: 'ext-id-1, ext-id-2' },
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
    />
  );
}
