'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PbxManager, parseJsonArray } from '@/components/v3/pbx/pbx-manager';
import { getMe, isUnauthorizedError } from '@/lib/api';
import { isV3PortalEnabled, v3QueuesApi } from '@/lib/v3-api';

const STRATEGIES = [
  { value: 'ROUND_ROBIN', label: 'Round Robin' },
  { value: 'LONGEST_IDLE', label: 'Longest Idle' },
  { value: 'LEAST_CALLS', label: 'Least Calls' },
  { value: 'RANDOM', label: 'Random' },
];

function toPayload(form: Record<string, unknown>) {
  const agents = form.agentsRaw
    ? parseJsonArray(String(form.agentsRaw))
    : (Array.isArray(form.agentExtensionIds) ? form.agentExtensionIds : []);
  return {
    name: form.name,
    queueNumber: form.queueNumber || null,
    strategy: form.strategy || 'ROUND_ROBIN',
    agentExtensionIds: agents,
    wrapUpTimeSeconds: Number(form.wrapUpTimeSeconds) || 0,
    maxWaiting: Number(form.maxWaiting) || 50,
    queueTimeoutSeconds: Number(form.queueTimeoutSeconds) || 120,
    isActive: form.isActive !== false,
  };
}

export default function V3QueuesPage() {
  const router = useRouter();

  useEffect(() => {
    if (!isV3PortalEnabled()) router.replace('/dashboard');
    else getMe().catch((e) => { if (isUnauthorizedError(e)) router.replace('/login'); });
  }, [router]);

  return (
    <PbxManager
      title="Call Queues"
      description="Queue configuration for Call Flow Builder — statistics are configuration-only."
      nameKey="name"
      fields={[
        { key: 'name', label: 'Queue Name' },
        { key: 'queueNumber', label: 'Queue Number' },
        { key: 'strategy', label: 'Strategy', type: 'select', options: STRATEGIES },
        { key: 'agentsRaw', label: 'Agent Extension IDs (comma-separated)' },
        { key: 'wrapUpTimeSeconds', label: 'Wrap-up Time (sec)', type: 'number' },
        { key: 'maxWaiting', label: 'Max Waiting', type: 'number' },
        { key: 'queueTimeoutSeconds', label: 'Queue Timeout (sec)', type: 'number' },
        { key: 'isActive', label: 'Active', type: 'checkbox' },
      ]}
      emptyForm={{ name: '', strategy: 'ROUND_ROBIN', wrapUpTimeSeconds: 0, maxWaiting: 50, queueTimeoutSeconds: 120, agentsRaw: '', isActive: true }}
      listItems={(s) => v3QueuesApi.list(s).then((r) => ({ items: r.items as { id: string }[] }))}
      createItem={(f) => v3QueuesApi.create(toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      updateItem={(id, f) => v3QueuesApi.update(id, toPayload(f)).then((r) => ({ item: r.item as { id: string } }))}
      deleteItem={(id) => v3QueuesApi.delete(id)}
      validateItem={(f) => v3QueuesApi.validate(toPayload(f))}
      formatRow={(item) => `${item.strategy} · ${(item.agentExtensionIds as string[])?.length || 0} agents`}
    />
  );
}
