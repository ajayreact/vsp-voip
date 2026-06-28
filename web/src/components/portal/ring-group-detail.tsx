'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Save,
  Trash2,
  UserMinus,
} from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { PortalPageHeader } from '@/components/portal/page-header';
import {
  addRingGroupMember,
  deleteRingGroup,
  getExtensions,
  getMe,
  getRingGroup,
  getRingGroupRoutingPreview,
  isUnauthorizedError,
  removeRingGroupMember,
  reorderRingGroupMembers,
  updateRingGroup,
  type ExtensionRecord,
  type RingGroupMember,
  type RingGroupRecord,
  type RingStrategy,
} from '@/lib/api';
import {
  RING_STRATEGIES,
  STRATEGY_LABELS,
  regStatusBadge,
  strategySupportsMemberOrder,
} from '@/lib/ring-group-utils';
import { SWAL_THEME } from '@/lib/swal-theme';

type MemberRow = RingGroupMember & {
  employeeName: string;
  mobileStatus: ExtensionRecord['deviceRegistration']['mobile'];
  deskStatus: ExtensionRecord['deviceRegistration']['sip'];
};

export function RingGroupDetailPage({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [group, setGroup] = useState<RingGroupRecord | null>(null);
  const [extensions, setExtensions] = useState<ExtensionRecord[]>([]);
  const [routingPreview, setRoutingPreview] = useState('');

  const [name, setName] = useState('');
  const [extensionNumber, setExtensionNumber] = useState('');
  const [ringStrategy, setRingStrategy] = useState<RingStrategy>('SIMULTANEOUS');
  const [ringTimeoutSeconds, setRingTimeoutSeconds] = useState(25);
  const [voicemailEnabled, setVoicemailEnabled] = useState(true);
  const [callRecordingEnabled, setCallRecordingEnabled] = useState(true);

  const extById = useMemo(
    () => new Map(extensions.map((ext) => [ext.id, ext])),
    [extensions],
  );

  const memberRows: MemberRow[] = useMemo(() => {
    const members = [...(group?.members || [])].sort((a, b) => a.priority - b.priority);
    return members.map((member) => {
      const ext = extById.get(member.extensionId);
      return {
        ...member,
        employeeName:
          member.extension?.user?.name
          || ext?.employeeName
          || member.extension?.displayName
          || '—',
        mobileStatus: ext?.deviceRegistration?.mobile || {
          status: 'UNREGISTERED',
          lastSeen: null,
          deviceName: null,
        },
        deskStatus: ext?.deviceRegistration?.sip || {
          status: 'UNREGISTERED',
          lastSeen: null,
          deviceName: null,
        },
      };
    });
  }, [group?.members, extById]);

  const reload = useCallback(async () => {
    const [groupRes, extRes] = await Promise.all([getRingGroup(groupId), getExtensions()]);
    const g = groupRes.ringGroup;
    setGroup(g);
    setExtensions(extRes.extensions || []);
    setName(g.name);
    setExtensionNumber(g.extensionNumber || '');
    setRingStrategy(g.ringStrategy);
    setRingTimeoutSeconds(g.ringTimeoutSeconds);
    setVoicemailEnabled(g.voicemailEnabled);
    setCallRecordingEnabled(g.callRecordingEnabled);

    try {
      const preview = await getRingGroupRoutingPreview(groupId);
      const lines = preview.preview.targets.map((t) => t.label);
      setRoutingPreview(
        lines.length
          ? `${STRATEGY_LABELS[g.ringStrategy]} — ${lines.join(' → ')}`
          : 'No dial targets — add extensions with registered devices',
      );
    } catch {
      setRoutingPreview('Could not load routing preview');
    }
  }, [groupId]);

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
  }, [groupId, router, reload]);

  async function onSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setError('');
    try {
      await updateRingGroup(groupId, {
        name: name.trim(),
        extensionNumber: extensionNumber.trim() || null,
        ringStrategy,
        ringTimeoutSeconds,
        voicemailEnabled,
        callRecordingEnabled,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteGroup() {
    const confirm = await Swal.fire({
      title: `Delete "${group?.name}"?`,
      text: 'The ring group will be deactivated.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;
    try {
      await deleteRingGroup(groupId);
      router.push('/ring-groups');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function onAddMember() {
    const memberIds = new Set((group?.members || []).map((m) => m.extensionId));
    const options = extensions
      .filter((ext) => ext.status === 'ACTIVE' && !memberIds.has(ext.id))
      .map(
        (ext) =>
          `<option value="${ext.id}">Ext ${ext.extensionNumber} — ${ext.displayName}</option>`,
      )
      .join('');

    const result = await Swal.fire({
      title: 'Add member',
      html: `<select id="member-ext" class="swal2-input" style="margin:0"><option value="">— Select extension —</option>${options}</select>`,
      showCancelButton: true,
      preConfirm: () => {
        const id = (document.getElementById('member-ext') as HTMLSelectElement)?.value;
        if (!id) {
          Swal.showValidationMessage('Select an extension');
          return false;
        }
        return id;
      },
      ...SWAL_THEME,
    });

    if (!result.isConfirmed || !result.value) return;
    setSaving(true);
    try {
      await addRingGroupMember(groupId, result.value);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setSaving(false);
    }
  }

  async function onRemoveMember(memberId: string) {
    const confirm = await Swal.fire({
      title: 'Remove member?',
      text: 'This extension will no longer ring in the group.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      ...SWAL_THEME,
    });
    if (!confirm.isConfirmed) return;
    try {
      await removeRingGroupMember(groupId, memberId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member');
    }
  }

  async function onMoveMember(memberId: string, direction: 'up' | 'down') {
    const ids = memberRows.map((m) => m.id);
    const index = ids.indexOf(memberId);
    if (index < 0) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ids.length) return;

    const reordered = [...ids];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

    setSaving(true);
    try {
      await reorderRingGroupMembers(groupId, reordered);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reorder members');
    } finally {
      setSaving(false);
    }
  }

  const showReorder = strategySupportsMemberOrder(ringStrategy);

  const memberColumns: DataTableColumn<MemberRow>[] = [
    {
      key: 'employeeName',
      header: 'Employee',
      sortable: true,
    },
    {
      key: 'extensionNumber',
      header: 'Extension',
      sortable: true,
      sortValue: (row) => Number(row.extension?.extensionNumber || 0),
      render: (row) => row.extension?.extensionNumber || '—',
    },
    {
      key: 'mobileStatus',
      header: 'Mobile status',
      sortable: true,
      sortValue: (row) => row.mobileStatus.status,
      render: (row) => regStatusBadge(row.mobileStatus),
    },
    {
      key: 'deskStatus',
      header: 'Desk phone status',
      sortable: true,
      sortValue: (row) => row.deskStatus.status,
      render: (row) => regStatusBadge(row.deskStatus),
      headerClassName: 'hidden lg:table-cell',
      className: 'hidden lg:table-cell',
    },
    {
      key: 'actions',
      header: 'Actions',
      searchable: false,
      sortable: false,
      render: (row) =>
        isAdmin ? (
          <div className="flex flex-wrap gap-1">
            {showReorder ? (
              <>
                <button
                  type="button"
                  onClick={() => onMoveMember(row.id, 'up')}
                  className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                  title="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveMember(row.id, 'down')}
                  className="rounded-lg p-1 text-slate-600 hover:bg-slate-100"
                  title="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={() => onRemoveMember(row.id)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <UserMinus className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>
        ) : null,
    },
  ];

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
      <PortalPageHeader
        title={group.name}
        description={`${STRATEGY_LABELS[group.ringStrategy]} · ${group.ringTimeoutSeconds}s timeout${group.extensionNumber ? ` · Ext ${group.extensionNumber}` : ''}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/ring-groups" className="filter-btn">
              ← All groups
            </Link>
            {isAdmin ? (
              <button
                type="button"
                onClick={onDeleteGroup}
                className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            ) : null}
          </div>
        }
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Members</p>
          <p className="mt-1 text-2xl font-semibold">{group.memberCount}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Calls offered</p>
          <p className="mt-1 text-2xl font-semibold">{analytics.callsOffered}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Answered</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{analytics.callsAnswered}</p>
        </div>
        <div className="panel-card p-4">
          <p className="text-xs uppercase text-slate-500">Missed</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{analytics.callsMissed}</p>
        </div>
      </div>

      {isAdmin ? (
        <form onSubmit={onSaveSettings} className="panel-card space-y-5 p-6">
          <h2 className="section-title">Edit ring group</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Group name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Virtual extension</span>
              <input
                value={extensionNumber}
                onChange={(e) => setExtensionNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional"
              />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Ring strategy</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {RING_STRATEGIES.map((s) => (
                <label
                  key={s.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${
                    ringStrategy === s.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="edit-strategy"
                    checked={ringStrategy === s.value}
                    onChange={() => setRingStrategy(s.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-slate-500">{s.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="block max-w-xs">
            <span className="mb-1 block text-sm font-medium text-slate-700">Ring timeout (seconds)</span>
            <input
              type="number"
              min={10}
              max={60}
              value={ringTimeoutSeconds}
              onChange={(e) => setRingTimeoutSeconds(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={voicemailEnabled}
                onChange={(e) => setVoicemailEnabled(e.target.checked)}
              />
              Group voicemail on no answer
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={callRecordingEnabled}
                onChange={(e) => setCallRecordingEnabled(e.target.checked)}
              />
              Record answered calls
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">Members</h2>
        {isAdmin ? (
          <button
            type="button"
            onClick={onAddMember}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add member
          </button>
        ) : null}
      </div>

      {showReorder && memberRows.length > 1 ? (
        <p className="text-sm text-slate-500">
          Member order applies to {STRATEGY_LABELS[ringStrategy]} ringing. Use arrows to reorder.
        </p>
      ) : null}

      <DataTable
        title="Group members"
        data={memberRows}
        getRowId={(row) => row.id}
        emptyMessage="No members yet. Add extensions to ring when this group is called."
        columns={memberColumns}
      />

      <div className="panel-card p-5">
        <h2 className="section-title">Routing preview</h2>
        <p className="mt-2 text-sm text-slate-600">{routingPreview}</p>
        {group.phoneNumbers?.length ? (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase text-slate-500">Assigned DIDs</p>
            <ul className="mt-1 text-sm text-slate-600">
              {group.phoneNumbers.map((n) => (
                <li key={n.id}>
                  {n.number}
                  {n.label ? ` (${n.label})` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Assign a DID to this group from{' '}
            <Link href="/phone-numbers" className="text-indigo-600 hover:text-indigo-700">
              Phone numbers
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
