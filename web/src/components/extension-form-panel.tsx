'use client';

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  Building2,
  ChevronDown,
  Hash,
  Loader2,
  Mail,
  Phone,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { SlideOverPanel } from '@/components/slide-over-panel';
import { ExtensionPrimaryDidSelect } from '@/components/extension-primary-did-select';
import { SWAL_THEME } from '@/lib/swal-theme';
import {
  createExtension,
  getAvailableExtensionDids,
  getExtension,
  getExtensionPhoneNumbers,
  getTenantUsers,
  setExtensionPrimaryPhoneNumber,
  suggestExtensionNumber,
  updateExtension,
  type ExtensionPhoneNumberRow,
  type ExtensionRecord,
  type TenantTeamUser,
} from '@/lib/api';

type FormData = {
  extensionNumber: string;
  displayName: string;
  email: string;
  department: string;
  userId: string;
  primaryPhoneNumberId: string;
  voicemailEnabled: boolean;
  callRecordingEnabled: boolean;
  webrtcEnabled: boolean;
  multiDeviceEnabled: boolean;
};

const EMPTY_FORM: FormData = {
  extensionNumber: '',
  displayName: '',
  email: '',
  department: '',
  userId: '',
  primaryPhoneNumberId: '',
  voicemailEnabled: true,
  callRecordingEnabled: true,
  webrtcEnabled: true,
  multiDeviceEnabled: true,
};

const FIELD_ICON = 'pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';
const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base font-medium text-slate-950 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';

function mergeDidOptions(
  primaryDid: ExtensionPhoneNumberRow | null | undefined,
  available: ExtensionPhoneNumberRow[],
) {
  const byId = new Map<string, ExtensionPhoneNumberRow>();
  if (primaryDid) byId.set(primaryDid.id, primaryDid);
  for (const row of available) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => a.number.localeCompare(b.number));
}

function employeeIsTakenElsewhere(user: TenantTeamUser, currentExtensionId?: string | null): boolean {
  if (!user.assignedExtension) return false;
  if (currentExtensionId && user.assignedExtension.id === currentExtensionId) return false;
  return true;
}

function employeeOptionLabel(user: TenantTeamUser): string {
  if (user.assignedExtension?.extensionNumber) {
    return `${user.name} · Extension ${user.assignedExtension.extensionNumber}`;
  }
  return user.name;
}

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  extensionId?: string | null;
  onClose: () => void;
  onSaved: (extension: ExtensionRecord) => void | Promise<void>;
};

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}

export function ExtensionFormPanel({ open, mode, extensionId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<TenantTeamUser[]>([]);
  const [didOptions, setDidOptions] = useState<ExtensionPhoneNumberRow[]>([]);
  const [extension, setExtension] = useState<ExtensionRecord | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [data, setData] = useState<FormData>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;

    setError('');
    setAdvancedOpen(false);
    setLoading(true);

    if (mode === 'create') {
      setExtension(null);
      setData(EMPTY_FORM);
      setUsers([]);
      setDidOptions([]);

      void Promise.allSettled([
        suggestExtensionNumber(),
        getTenantUsers(),
        getAvailableExtensionDids(),
      ]).then(([suggestedResult, teamResult, didsResult]) => {
        if (suggestedResult.status === 'fulfilled') {
          setData((prev) => ({ ...prev, extensionNumber: suggestedResult.value.extensionNumber }));
        } else {
          setError(
            suggestedResult.reason instanceof Error
              ? suggestedResult.reason.message
              : 'Could not suggest extension number',
          );
        }

        if (teamResult.status === 'fulfilled') {
          setUsers(teamResult.value.users || []);
        } else {
          setUsers([]);
        }

        if (didsResult.status === 'fulfilled') {
          setDidOptions(didsResult.value.available || []);
        } else {
          setDidOptions([]);
        }
      }).finally(() => setLoading(false));
      return;
    }

    if (!extensionId) {
      setLoading(false);
      return;
    }

    void Promise.allSettled([
      getExtension(extensionId),
      getTenantUsers(),
      getExtensionPhoneNumbers(extensionId),
    ]).then(([extResult, teamResult, didsResult]) => {
      if (extResult.status === 'fulfilled') {
        const ext = extResult.value.extension;
        setExtension(ext);
        setData({
          extensionNumber: ext.extensionNumber,
          displayName: ext.displayName,
          email: ext.email || '',
          department: ext.department || '',
          userId: ext.userId || '',
          primaryPhoneNumberId: ext.primaryPhoneNumberId || '',
          voicemailEnabled: ext.features.voicemailEnabled,
          callRecordingEnabled: ext.features.callRecordingEnabled,
          webrtcEnabled: ext.registration.webrtcEnabled,
          multiDeviceEnabled: ext.registration.multiDeviceEnabled,
        });
      } else {
        setError(
          extResult.reason instanceof Error ? extResult.reason.message : 'Could not load extension',
        );
      }

      if (teamResult.status === 'fulfilled') {
        setUsers(teamResult.value.users || []);
      } else {
        setUsers([]);
      }

      if (didsResult.status === 'fulfilled') {
        setDidOptions(mergeDidOptions(didsResult.value.primaryDid, didsResult.value.available || []));
      } else {
        setDidOptions([]);
      }
    }).finally(() => setLoading(false));
  }, [open, mode, extensionId]);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function onSelectEmployee(userId: string) {
    updateField('userId', userId);
    if (!userId) return;
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setData((prev) => ({
      ...prev,
      userId,
      displayName: prev.displayName.trim() ? prev.displayName : user.name,
      email: prev.email.trim() ? prev.email : user.email,
    }));
  }

  const selectedUser = users.find((u) => u.id === data.userId) || null;

  function validate(): string | null {
    if (!data.displayName.trim()) return 'Display name is required';
    if (mode === 'create' && !/^\d{2,6}$/.test(data.extensionNumber.trim())) {
      return 'Extension number must be 2–6 digits';
    }
    return null;
  }

  async function onSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (selectedUser && employeeIsTakenElsewhere(selectedUser, mode === 'edit' ? extensionId : null)) {
      const extNum = selectedUser.assignedExtension!.extensionNumber;
      const result = await Swal.fire({
        title: 'Reassign employee?',
        text: `This employee currently owns Extension ${extNum}. Saving will reassign ownership.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Save and reassign',
        cancelButtonText: 'Cancel',
        ...SWAL_THEME,
      });
      if (!result.isConfirmed) return;
    }

    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        const res = await createExtension({
          extensionNumber: data.extensionNumber.trim(),
          displayName: data.displayName.trim(),
          email: data.email.trim() || undefined,
          department: data.department.trim() || undefined,
          userId: data.userId || undefined,
          primaryPhoneNumberId: data.primaryPhoneNumberId || undefined,
          voicemailEnabled: data.voicemailEnabled,
          callRecordingEnabled: data.callRecordingEnabled,
          webrtcEnabled: data.webrtcEnabled,
          multiDeviceEnabled: data.multiDeviceEnabled,
        });
        await onSaved(res.extension);
        onClose();
        return;
      }

      if (!extension) return;

      const res = await updateExtension(extension.id, {
        displayName: data.displayName.trim(),
        email: data.email.trim() || undefined,
        department: data.department.trim() || undefined,
        userId: data.userId || null,
        voicemailEnabled: data.voicemailEnabled,
        callRecordingEnabled: data.callRecordingEnabled,
        webrtcEnabled: data.webrtcEnabled,
        multiDeviceEnabled: data.multiDeviceEnabled,
      });

      const nextPrimaryId = data.primaryPhoneNumberId || null;
      const prevPrimaryId = extension.primaryPhoneNumberId || null;
      let updated = res.extension;
      if (nextPrimaryId !== prevPrimaryId) {
        const didRes = await setExtensionPrimaryPhoneNumber(extension.id, nextPrimaryId);
        updated = didRes.extension;
      }

      await onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'create' ? 'Add extension' : 'Edit extension';

  const headerExtra =
    mode === 'edit' && extension ? (
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          Extension {extension.extensionNumber}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          {extension.status.charAt(0) + extension.status.slice(1).toLowerCase()}
        </span>
      </div>
    ) : mode === 'create' ? (
      <p className="text-sm text-slate-500">
        Company → Extension → Assigned Phone Number → Employee
      </p>
    ) : null;

  return (
    <SlideOverPanel
      open={open}
      onClose={onClose}
      title={title}
      side="right"
      headerExtra={headerExtra}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={onSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'create' ? 'Create extension' : 'Save changes'}
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-5">
          {mode === 'create' ? (
            <p className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2.5 text-sm text-indigo-900">
              Extensions and phone numbers are long-lived assets. Employees can be reassigned at any time.
            </p>
          ) : null}

          {/* 1. Extension Number */}
          {mode === 'create' ? (
            <div>
              <FieldLabel htmlFor="ext-number">Extension Number</FieldLabel>
              <div className="relative">
                <Hash className={FIELD_ICON} aria-hidden />
                <input
                  id="ext-number"
                  className={INPUT_CLASS}
                  value={data.extensionNumber}
                  onChange={(e) => updateField('extensionNumber', e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 101"
                  maxLength={6}
                  inputMode="numeric"
                  disabled={saving}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Next available number suggested. You can change it.</p>
            </div>
          ) : null}

          {/* 2. Display Name */}
          <div>
            <FieldLabel htmlFor="ext-display-name">Display Name</FieldLabel>
            <div className="relative">
              <User className={FIELD_ICON} aria-hidden />
              <input
                id="ext-display-name"
                className={INPUT_CLASS}
                value={data.displayName}
                onChange={(e) => updateField('displayName', e.target.value)}
                placeholder="e.g. Reception"
                disabled={saving}
              />
            </div>
          </div>

          {/* 3. Assigned Phone Number */}
          <div>
            <FieldLabel htmlFor="extension-primary-did">Assigned Phone Number</FieldLabel>
            <p className="mb-2 text-xs text-slate-500">Select phone number (optional)</p>
            <div className="relative">
              <Phone className={FIELD_ICON} aria-hidden />
              <ExtensionPrimaryDidSelect
                value={data.primaryPhoneNumberId}
                options={didOptions}
                onChange={(id) => updateField('primaryPhoneNumberId', id)}
                disabled={saving}
                emptyOptionLabel="Select phone number..."
              />
            </div>
          </div>

          {/* 4. Assign Employee */}
          <div>
            <FieldLabel htmlFor="ext-user">Assign Employee</FieldLabel>
            <p className="mb-2 text-xs text-slate-500">Select employee (optional)</p>
            <div className="relative">
              <Users className={FIELD_ICON} aria-hidden />
              <select
                id="ext-user"
                className={`${INPUT_CLASS} ${!data.userId ? 'text-slate-500' : ''}`}
                value={data.userId}
                onChange={(e) => onSelectEmployee(e.target.value)}
                disabled={saving}
              >
                <option value="" className="font-normal text-slate-500">
                  Select employee...
                </option>
                {[...users]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((user) => (
                    <option key={user.id} value={user.id} className="font-medium text-slate-950">
                      {employeeOptionLabel(user)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* 5. Email */}
          <div>
            <FieldLabel htmlFor="ext-email">Email</FieldLabel>
            <div className="relative">
              <Mail className={FIELD_ICON} aria-hidden />
              <input
                id="ext-email"
                type="email"
                className={INPUT_CLASS}
                value={data.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="name@company.com"
                disabled={saving}
              />
            </div>
          </div>

          {/* 6. Department */}
          <div>
            <FieldLabel htmlFor="ext-department">Department</FieldLabel>
            <div className="relative">
              <Building2 className={FIELD_ICON} aria-hidden />
              <input
                id="ext-department"
                className={INPUT_CLASS}
                value={data.department}
                onChange={(e) => updateField('department', e.target.value)}
                placeholder="e.g. Sales"
                disabled={saving}
              />
            </div>
          </div>

          {/* 7. Advanced Settings */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50/80"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-slate-400" aria-hidden />
                Advanced Settings
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedOpen ? (
              <div className="space-y-3 border-t border-slate-100 px-4 py-4">
                {[
                  { key: 'voicemailEnabled' as const, label: 'Voicemail', desc: 'Allow callers to leave a message' },
                  {
                    key: 'callRecordingEnabled' as const,
                    label: 'Call recording',
                    desc: 'Record calls when policy allows',
                  },
                  { key: 'webrtcEnabled' as const, label: 'Web softphone', desc: 'Use browser-based calling' },
                  { key: 'multiDeviceEnabled' as const, label: 'Multi-device', desc: 'Register mobile and web clients' },
                ].map((item) => (
                  <label key={item.key} className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={data[item.key]}
                      onChange={(e) => updateField(item.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      disabled={saving}
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{item.label}</span>
                      <span className="block text-xs text-slate-500">{item.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}
    </SlideOverPanel>
  );
}
