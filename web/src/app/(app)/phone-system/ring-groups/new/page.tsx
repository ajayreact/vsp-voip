'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PhoneSystemNav } from '@/components/phone-system-nav';
import { createRingGroup, type RingStrategy } from '@/lib/api';

const STRATEGIES: { value: RingStrategy; label: string; hint: string }[] = [
  { value: 'SIMULTANEOUS', label: 'Simultaneous', hint: 'Ring all members at once; first answer wins' },
  { value: 'SEQUENTIAL', label: 'Sequential', hint: 'Ring members one at a time in priority order' },
  { value: 'ROUND_ROBIN', label: 'Round robin', hint: 'Rotate starting member on each call' },
  { value: 'LONGEST_IDLE', label: 'Longest idle', hint: 'Offer to the member idle the longest first' },
];

export default function NewRingGroupPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [extensionNumber, setExtensionNumber] = useState('');
  const [ringStrategy, setRingStrategy] = useState<RingStrategy>('SIMULTANEOUS');
  const [ringTimeoutSeconds, setRingTimeoutSeconds] = useState(25);
  const [voicemailEnabled, setVoicemailEnabled] = useState(true);
  const [callRecordingEnabled, setCallRecordingEnabled] = useState(true);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await createRingGroup({
        name: name.trim(),
        extensionNumber: extensionNumber.trim() || null,
        ringStrategy,
        ringTimeoutSeconds,
        voicemailEnabled,
        callRecordingEnabled,
      });
      router.push(`/phone-system/ring-groups/${res.ringGroup.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ring group');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Create ring group</h2>
        <p className="text-sm text-slate-400">Configure ringing strategy and group settings.</p>
      </div>

      <PhoneSystemNav />

      <form onSubmit={onSubmit} className="max-w-xl space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Sales team"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Virtual extension (optional)</label>
          <input
            value={extensionNumber}
            onChange={(e) => setExtensionNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="200"
          />
          <p className="mt-1 text-xs text-slate-400">Internal extension number for this group</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Ring strategy</label>
          <div className="mt-2 space-y-2">
            {STRATEGIES.map((s) => (
              <label
                key={s.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                  ringStrategy === s.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={s.value}
                  checked={ringStrategy === s.value}
                  onChange={() => setRingStrategy(s.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{s.label}</span>
                  <span className="block text-xs text-slate-500">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Ring timeout (seconds)</label>
          <input
            type="number"
            min={10}
            max={60}
            value={ringTimeoutSeconds}
            onChange={(e) => setRingTimeoutSeconds(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-3">
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
            Record answered group calls
          </label>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create ring group
          </button>
          <Link
            href="/phone-system/ring-groups"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
