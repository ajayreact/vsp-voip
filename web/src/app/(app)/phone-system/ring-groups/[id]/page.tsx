'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, RefreshCw } from 'lucide-react';
import { PhoneSystemNav } from '@/components/phone-system-nav';
import {
  addRingGroupMember,
  getExtensions,
  getMe,
  getRingGroup,
  getRingGroupRoutingPreview,
  getRingGroupVoicemails,
  isUnauthorizedError,
  removeRingGroupMember,
  updateRingGroup,
  type ExtensionRecord,
  type RingGroupRecord,
  type RingStrategy,
  type VoicemailRecord,
} from '@/lib/api';

const STRATEGY_LABELS: Record<RingStrategy, string> = {
  SIMULTANEOUS: 'Simultaneous',
  SEQUENTIAL: 'Sequential',
  ROUND_ROBIN: 'Round robin',
  LONGEST_IDLE: 'Longest idle',
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function RingGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [group, setGroup] = useState<RingGroupRecord | null>(null);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [selectedExtensionId, setSelectedExtensionId] = useState('');
  const [voicemails, setVoicemails] = useState<VoicemailRecord[]>([]);
  const [routingPreview, setRoutingPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function reload() {
    const [groupRes, extRes, vmRes] = await Promise.all([
      getRingGroup(id),
      getExtensions(),
      getRingGroupVoicemails(id),
    ]);
    setGroup(groupRes.ringGroup);
    setExtensions(extRes.extensions.filter((e) => e.status === 'ACTIVE'));
    setVoicemails(vmRes.voicemails);
  }

  async function loadRoutingPreview() {
    try {
      const res = await getRingGroupRoutingPreview(id);
      const lines = res.preview.targets.map(
        (t) => `${t.label} (${t.type}${t.sipUsername ? ', WebRTC/mobile ready' : ', no SIP'})`,
      );
      setRoutingPreview(
        lines.length
          ? `${STRATEGY_LABELS[group?.ringStrategy || 'SIMULTANEOUS']} — ${lines.join(' → ')}`
          : 'No dial targets — assign extensions with linked users',
      );
    } catch {
      setRoutingPreview('Could not load routing preview');
    }
  }

  useEffect(() => {
    getMe()
      .then((user) => {
        if (!user.tenantId) {
          router.replace('/dashboard');
          return;
        }
        setIsAdmin(user.role === 'TENANT_ADMIN' || user.role === 'SUPER_ADMIN');
        return reload();
      })
      .catch((err) => {
        if (isUnauthorizedError(err)) router.replace('/login');
        else setError(err instanceof Error ? err.message : 'Could not load ring group');
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  useEffect(() => {
    if (group) loadRoutingPreview();
  }, [group?.id, group?.members?.length]);

  async function onAddMember() {
    if (!selectedExtensionId) return;
    setSaving(true);
    setError('');
    try {
      await addRingGroupMember(id, selectedExtensionId);
      setSelectedExtensionId('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveMember(memberId: string) {
    if (!confirm('Remove this extension from the ring group?')) return;
    try {
      await removeRingGroupMember(id, memberId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
    }
  }

  async function onToggleSetting(field: 'voicemailEnabled' | 'callRecordingEnabled', value: boolean) {
    if (!group) return;
    setSaving(true);
    try {
      await updateRingGroup(id, { [field]: value });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const memberExtensionIds = new Set(group?.members?.map((m) => m.extensionId) || []);
  const availableExtensions = extensions.filter((e) => !memberExtensionIds.has(e.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading ring group…
      </div>
    );
  }

  if (!group) {
    return <p className="text-sm text-red-600">Ring group not found</p>;
  }

  const analytics = group.analytics;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/phone-system/ring-groups" className="text-sm text-indigo-600 hover:text-indigo-700">
            ← Ring groups
          </Link>
          <h2 className="mt-2 text-lg font-medium text-slate-900">{group.name}</h2>
          <p className="text-sm text-slate-400">
            {STRATEGY_LABELS[group.ringStrategy]} · {group.ringTimeoutSeconds}s timeout
            {group.extensionNumber ? ` · Ext ${group.extensionNumber}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reload().then(loadRoutingPreview)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <PhoneSystemNav />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Calls offered" value={analytics.callsOffered} />
        <StatCard label="Calls answered" value={analytics.callsAnswered} />
        <StatCard label="Calls missed" value={analytics.callsMissed} />
        <StatCard
          label="Avg answer time"
          value={`${analytics.averageAnswerTimeSeconds}s`}
          hint="From offer to answer"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-medium text-slate-900">Members</h3>
          <p className="mt-1 text-sm text-slate-400">Extensions that ring when this group is called.</p>

          {isAdmin ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <select
                value={selectedExtensionId}
                onChange={(e) => setSelectedExtensionId(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select extension…</option>
                {availableExtensions.map((ext) => (
                  <option key={ext.id} value={ext.id}>
                    {ext.extensionNumber} — {ext.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!selectedExtensionId || saving}
                onClick={onAddMember}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>
          ) : null}

          <ul className="mt-4 divide-y divide-slate-100">
            {(group.members || []).length === 0 ? (
              <li className="py-4 text-sm text-slate-500">No members yet.</li>
            ) : (
              group.members?.map((member, index) => (
                <li key={member.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {index + 1}. {member.extension?.extensionNumber} — {member.extension?.displayName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {member.extension?.user?.hasSipCredential
                        ? member.extension.user.sipRegistered
                          ? 'WebRTC/mobile ready'
                          : 'SIP credential provisioned'
                        : 'No linked user / SIP'}
                    </p>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => onRemoveMember(member.id)}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-medium text-slate-900">Group settings</h3>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={group.voicemailEnabled}
                  disabled={!isAdmin || saving}
                  onChange={(e) => onToggleSetting('voicemailEnabled', e.target.checked)}
                />
                Group voicemail fallback
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={group.callRecordingEnabled}
                  disabled={!isAdmin || saving}
                  onChange={(e) => onToggleSetting('callRecordingEnabled', e.target.checked)}
                />
                Record answered calls
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-medium text-slate-900">Routing preview</h3>
            <p className="mt-2 text-sm text-slate-600">{routingPreview || 'Loading…'}</p>
            {group.phoneNumbers?.length ? (
              <div className="mt-3">
                <p className="text-xs font-medium uppercase text-slate-500">Assigned numbers</p>
                <ul className="mt-1 text-sm text-slate-600">
                  {group.phoneNumbers.map((n) => (
                    <li key={n.id}>{n.number}{n.label ? ` (${n.label})` : ''}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Assign a phone number to this group from Numbers → routing type Ring group.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-medium text-slate-900">Group voicemail ({voicemails.length})</h3>
            {voicemails.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No group voicemails yet.</p>
            ) : (
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                {voicemails.slice(0, 5).map((vm) => (
                  <li key={vm.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-medium">{vm.from}</span>
                    <span className="text-slate-400"> · {new Date(vm.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
