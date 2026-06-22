'use client';

import { useEffect, useState } from 'react';
import {
  getExtensionDestinations,
  updateExtensionBusiness,
  initiateExtensionIntercom,
  type ExtensionRecord,
  type ForwardDestinationType,
  type ForwardRule,
} from '@/lib/api';

const emptyRule = (): ForwardRule => ({
  enabled: false,
  destinationType: null,
  destination: null,
});

type Props = {
  extension: ExtensionRecord;
  isAdmin: boolean;
  onUpdated: (ext: ExtensionRecord) => void;
};

export function ExtensionBusinessPanel({ extension, isAdmin, onUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [intercomTarget, setIntercomTarget] = useState('');
  const [intercomResult, setIntercomResult] = useState('');
  const [destinations, setDestinations] = useState<{
    extensions: Array<{ id: string; label: string; extensionNumber: string }>;
    ringGroups: Array<{ id: string; label: string }>;
  }>({ extensions: [], ringGroups: [] });

  const [dnd, setDnd] = useState(extension.dnd || {
    enabled: false,
    reason: null,
    scheduledEnabled: false,
    schedule: {},
    inboundAction: 'VOICEMAIL' as const,
  });
  const [features, setFeatures] = useState(extension.features);
  const [forwarding, setForwarding] = useState(extension.forwarding || {
    always: emptyRule(),
    busy: emptyRule(),
    noAnswer: emptyRule(),
    schedule: { ...emptyRule(), rules: {} },
  });

  useEffect(() => {
    if (!isAdmin) return;
    getExtensionDestinations()
      .then((res) => setDestinations({ extensions: res.extensions, ringGroups: res.ringGroups }))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    setDnd(extension.dnd || dnd);
    setFeatures(extension.features);
    if (extension.forwarding) setForwarding(extension.forwarding);
  }, [extension]);

  function updateRule(key: keyof typeof forwarding, patch: Partial<ForwardRule>) {
    setForwarding((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function destinationOptions(type: ForwardDestinationType | null) {
    if (type === 'EXTENSION') {
      return destinations.extensions.filter((e) => e.id !== extension.id);
    }
    if (type === 'RING_GROUP') return destinations.ringGroups;
    return [];
  }

  async function onSave() {
    setSaving(true);
    setError('');
    try {
      const res = await updateExtensionBusiness(extension.id, {
        doNotDisturb: dnd.enabled,
        callScreeningEnabled: features.callScreeningEnabled,
        intercomEnabled: features.intercomEnabled,
        callRecordingEnabled: features.callRecordingEnabled,
        voicemailEnabled: features.voicemailEnabled,
        dnd,
        forwarding,
      });
      onUpdated(res.extension);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onIntercom() {
    setIntercomResult('');
    try {
      const res = await initiateExtensionIntercom(extension.id, intercomTarget.trim());
      setIntercomResult(res.intercom.message);
    } catch (err) {
      setIntercomResult(err instanceof Error ? err.message : 'Intercom failed');
    }
  }

  function renderForwardRule(
    label: string,
    key: 'always' | 'busy' | 'noAnswer' | 'schedule',
  ) {
    const rule = forwarding[key];
    return (
      <div className="rounded-lg border border-slate-100 p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={rule.enabled}
            onChange={(e) => updateRule(key, { enabled: e.target.checked })}
          />
          {label}
        </label>
        {rule.enabled ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              disabled={!isAdmin}
              value={rule.destinationType || ''}
              onChange={(e) =>
                updateRule(key, {
                  destinationType: (e.target.value || null) as ForwardDestinationType | null,
                  destination: null,
                })
              }
            >
              <option value="">Destination type</option>
              <option value="EXTENSION">Extension</option>
              <option value="RING_GROUP">Ring group</option>
              <option value="EXTERNAL_NUMBER">External number</option>
            </select>
            {rule.destinationType === 'EXTERNAL_NUMBER' ? (
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                disabled={!isAdmin}
                placeholder="+15551234567"
                value={rule.destination || ''}
                onChange={(e) => updateRule(key, { destination: e.target.value })}
              />
            ) : (
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                disabled={!isAdmin}
                value={rule.destination || ''}
                onChange={(e) => updateRule(key, { destination: e.target.value })}
              >
                <option value="">Select destination</option>
                {destinationOptions(rule.destinationType).map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Do not disturb</h3>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={dnd.enabled}
              onChange={(e) => setDnd((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Enable DND now
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={dnd.scheduledEnabled}
              onChange={(e) => setDnd((prev) => ({ ...prev, scheduledEnabled: e.target.checked }))}
            />
            Use DND schedule (business hours pattern)
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={!isAdmin}
            placeholder="DND reason (optional)"
            value={dnd.reason || ''}
            onChange={(e) => setDnd((prev) => ({ ...prev, reason: e.target.value }))}
          />
          <label className="block text-sm">
            <span className="text-slate-600">When DND is active, send calls to</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              disabled={!isAdmin}
              value={dnd.inboundAction}
              onChange={(e) =>
                setDnd((prev) => ({
                  ...prev,
                  inboundAction: e.target.value as 'VOICEMAIL' | 'FORWARD',
                }))
              }
            >
              <option value="VOICEMAIL">Voicemail</option>
              <option value="FORWARD">Forwarding destination</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Call forwarding</h3>
        <div className="mt-4 space-y-3">
          {renderForwardRule('Always forward', 'always')}
          {renderForwardRule('Busy forward', 'busy')}
          {renderForwardRule('No answer forward', 'noAnswer')}
          {renderForwardRule('Schedule forward', 'schedule')}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Call features</h3>
        <div className="mt-4 space-y-2">
          {[
            { key: 'callScreeningEnabled' as const, label: 'Call screening', desc: 'Announce caller before connecting' },
            { key: 'intercomEnabled' as const, label: 'Intercom', desc: 'Allow extension-to-extension intercom' },
            { key: 'voicemailEnabled' as const, label: 'Voicemail', desc: 'Voicemail when unavailable' },
            { key: 'callRecordingEnabled' as const, label: 'Call recording', desc: 'Record when policy allows' },
          ].map((item) => (
            <label key={item.key} className="flex items-start gap-2 rounded-lg border border-slate-100 p-3 text-sm">
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={features[item.key]}
                onChange={(e) => setFeatures((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-slate-900">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {features.intercomEnabled ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Intercom</h3>
          <p className="mt-1 text-sm text-slate-500">
            Call another extension directly — e.g. {extension.extensionNumber} → 102
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Target extension (e.g. 102)"
              value={intercomTarget}
              onChange={(e) => setIntercomTarget(e.target.value)}
            />
            <button
              type="button"
              onClick={onIntercom}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Start intercom
            </button>
          </div>
          {intercomResult ? <p className="mt-2 text-sm text-slate-600">{intercomResult}</p> : null}
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {isAdmin ? (
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save business features'}
        </button>
      ) : null}
    </div>
  );
}
