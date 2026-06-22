'use client';

import { useEffect, useState } from 'react';
import {
  getCallRouting,
  getMe,
  getTenantUsers,
  isUnauthorizedError,
  saveCallRouting,
  uploadGreetingAudio,
  type CallRoutingConfig,
  type IvrOption,
  type GreetingRingGroupMember,
  type TenantTeamUser,
} from '@/lib/api';
import { defaultBusinessHours } from '@/lib/businessHoursDefaults';

type Tab = 'greeting' | 'hours' | 'forward' | 'ring' | 'voicemail' | 'recording' | 'ivr';

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const DEFAULT_IVR: IvrOption[] = [
  { digit: '1', label: 'Sales', action: 'message', message: 'Thank you for calling sales at {company}.', forwardTo: '' },
  { digit: '2', label: 'Support', action: 'ring_group', message: '', forwardTo: '' },
];

export default function GreetingPage() {
  const [tab, setTab] = useState<Tab>('greeting');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState('');
  const [afterHoursMessage, setAfterHoursMessage] = useState('');
  const [afterHoursPreview, setAfterHoursPreview] = useState('');
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [businessHours, setBusinessHours] = useState(defaultBusinessHours());
  const [timezone, setTimezone] = useState('America/New_York');
  const [ivrEnabled, setIvrEnabled] = useState(false);
  const [ivrPrompt, setIvrPrompt] = useState('');
  const [ivrOptions, setIvrOptions] = useState<IvrOption[]>(DEFAULT_IVR);

  const [forwardEnabled, setForwardEnabled] = useState(false);
  const [forwardNumber, setForwardNumber] = useState('');
  const [playGreetingBeforeConnect, setPlayGreetingBeforeConnect] = useState(true);

  const [ringGroupEnabled, setRingGroupEnabled] = useState(false);
  const [ringGroupName, setRingGroupName] = useState('');
  const [ringGroupMembers, setRingGroupMembers] = useState<GreetingRingGroupMember[]>([
    { phone: '', label: 'Agent 1' },
  ]);
  const [ringStrategy, setRingStrategy] = useState<'simultaneous' | 'sequential'>('simultaneous');
  const [ringTimeout, setRingTimeout] = useState(25);
  const [noAnswerMessage, setNoAnswerMessage] = useState('');
  const [noAnswerPreview, setNoAnswerPreview] = useState('');

  const [voicemailEnabled, setVoicemailEnabled] = useState(true);
  const [voicemailPrompt, setVoicemailPrompt] = useState('');
  const [voicemailPromptPreview, setVoicemailPromptPreview] = useState('');
  const [voicemailMaxLength, setVoicemailMaxLength] = useState(120);
  const [afterHoursVoicemailEnabled, setAfterHoursVoicemailEnabled] = useState(false);

  const [callRecordingEnabled, setCallRecordingEnabled] = useState(true);
  const [callRecordingNotice, setCallRecordingNotice] = useState('');
  const [callRecordingNoticePreview, setCallRecordingNoticePreview] = useState('');
  const [playCallRecordingNotice, setPlayCallRecordingNotice] = useState(true);
  const [greetingAudioUrl, setGreetingAudioUrl] = useState('');
  const [ivrPromptAudioUrl, setIvrPromptAudioUrl] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState<'greeting' | 'ivr' | null>(null);
  const [teamUsers, setTeamUsers] = useState<TenantTeamUser[]>([]);

  useEffect(() => {
    getMe()
      .then(async (user) => {
        if (!user.tenantId) {
          setError('No organization linked to this account.');
          return;
        }
        setTenantId(user.tenantId);
        const res = await getCallRouting(user.tenantId);
        applyRouting(res.routing);
        getTenantUsers()
          .then((team) => setTeamUsers(team.users || []))
          .catch(() => setTeamUsers([]));
      })
      .catch((err) => {
        if (!isUnauthorizedError(err)) {
          setError(err instanceof Error ? err.message : 'Could not load call routing');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function applyRouting(routing: CallRoutingConfig) {
    setMessage(routing.message);
    setPreview(routing.preview);
    setAfterHoursMessage(routing.afterHoursMessage);
    setAfterHoursPreview(routing.afterHoursPreview);
    setBusinessHoursEnabled(routing.businessHoursEnabled);
    setBusinessHours(routing.businessHours || defaultBusinessHours());
    setTimezone(routing.timezone);
    setIvrEnabled(routing.ivrEnabled);
    setIvrPrompt(routing.ivrPrompt);
    setIvrOptions(routing.ivrOptions.length ? routing.ivrOptions : DEFAULT_IVR);
    setForwardEnabled(routing.forwardEnabled);
    setForwardNumber(routing.forwardNumber);
    setPlayGreetingBeforeConnect(routing.playGreetingBeforeConnect);
    setRingGroupEnabled(routing.ringGroupEnabled);
    setRingGroupName(routing.ringGroupName);
    setRingGroupMembers(
      routing.ringGroupMembers.length
        ? routing.ringGroupMembers.map((member) => ({
            type: member.type || (member.userId ? 'app' : 'phone'),
            phone: member.phone || '',
            userId: member.userId || null,
            label: member.label,
          }))
        : [{ type: 'phone', phone: '', label: 'Agent 1' }],
    );
    setRingStrategy(routing.ringStrategy);
    setRingTimeout(routing.ringTimeout);
    setNoAnswerMessage(routing.noAnswerMessage);
    setNoAnswerPreview(routing.noAnswerPreview);
    setVoicemailEnabled(routing.voicemailEnabled);
    setVoicemailPrompt(routing.voicemailPrompt);
    setVoicemailPromptPreview(routing.voicemailPromptPreview);
    setVoicemailMaxLength(routing.voicemailMaxLength);
    setAfterHoursVoicemailEnabled(routing.afterHoursVoicemailEnabled);
    setCallRecordingEnabled(routing.callRecordingEnabled);
    setCallRecordingNotice(routing.callRecordingNotice);
    setCallRecordingNoticePreview(routing.callRecordingNoticePreview);
    setPlayCallRecordingNotice(routing.playCallRecordingNotice);
    setGreetingAudioUrl(routing.greetingAudioUrl || '');
    setIvrPromptAudioUrl(routing.ivrPromptAudioUrl || '');
  }

  async function onSave() {
    if (!tenantId) return;
    setSaving(true);
    setError('');
    try {
      const res = await saveCallRouting(tenantId, {
        message,
        afterHoursMessage,
        businessHoursEnabled,
        businessHours,
        ivrEnabled,
        ivrPrompt,
        ivrOptions,
        forwardEnabled,
        forwardNumber,
        playGreetingBeforeConnect,
        ringGroupEnabled,
        ringGroupName,
        ringGroupMembers,
        ringStrategy,
        ringTimeout,
        noAnswerMessage,
        voicemailEnabled,
        voicemailPrompt,
        voicemailMaxLength,
        afterHoursVoicemailEnabled,
        callRecordingEnabled,
        callRecordingNotice,
        playCallRecordingNotice,
        greetingAudioUrl,
        ivrPromptAudioUrl,
      });
      applyRouting(res.routing);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onUploadAudio(field: 'greetingAudioUrl' | 'ivrPromptAudioUrl', file: File | null) {
    if (!file) return;
    setUploadingAudio(field === 'greetingAudioUrl' ? 'greeting' : 'ivr');
    setError('');
    try {
      const res = await uploadGreetingAudio(field, file);
      applyRouting(res.routing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audio upload failed');
    } finally {
      setUploadingAudio(null);
    }
  }

  function updateHourDay(day: string, field: 'enabled' | 'open' | 'close', value: string | boolean) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function updateIvrOption(index: number, field: keyof IvrOption, value: string) {
    setIvrOptions((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function updateRingMember(index: number, field: keyof GreetingRingGroupMember, value: string) {
    setRingGroupMembers((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (field === 'type') {
          const type = value === 'app' ? 'app' : 'phone';
          return {
            ...item,
            type,
            phone: type === 'phone' ? item.phone || '' : '',
            userId: type === 'app' ? item.userId || teamUsers[0]?.id || null : null,
          };
        }
        return { ...item, [field]: value };
      }),
    );
  }

  if (loading) {
    return <div className="py-24 text-center text-slate-400">Loading call routing…</div>;
  }

  if (error && !tenantId) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Call routing</h2>
        <p className="text-sm text-slate-400">
          Greeting, forward, ring groups, business hours, and IVR. Timezone: {timezone.replace(/_/g, ' ')} (Settings → Company profile).
          {!businessHoursEnabled ? (
            <span className="ml-1 text-emerald-600">· Inbound calls: 24/7</span>
          ) : (
            <span className="ml-1 text-amber-600">· Business hours restriction enabled</span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {([
          ['greeting', 'Greeting'],
          ['forward', 'Call forward'],
          ['ring', 'Ring group'],
          ['voicemail', 'Voicemail'],
          ['recording', 'Call recording'],
          ['hours', 'Business hours'],
          ['ivr', 'IVR menu'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={tab === id ? 'filter-btn filter-btn-active' : 'filter-btn'}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel-card p-6 space-y-4">
        {tab === 'greeting' ? (
          <>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Open-hours greeting</span>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg input-field outline-none ring-indigo-500/30 focus:ring-2"
              />
            </label>
            <div className="rounded-lg bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Preview</p>
              <p className="mt-1 text-slate-700">{preview || '—'}</p>
            </div>
            <p className="text-xs text-slate-500">
              Used before connecting when call forward or ring group is enabled (unless disabled below).
            </p>
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-800">Custom greeting audio (optional)</p>
              <p className="text-xs text-slate-500">
                Upload MP3/WAV to replace TTS for this greeting. Text greeting is still used as fallback.
              </p>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => onUploadAudio('greetingAudioUrl', e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600"
              />
              {uploadingAudio === 'greeting' ? (
                <p className="text-xs text-indigo-600">Uploading…</p>
              ) : null}
              {greetingAudioUrl ? (
                <audio controls src={greetingAudioUrl} className="w-full max-w-md" />
              ) : null}
            </div>
          </>
        ) : null}

        {tab === 'forward' ? (
          <>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={forwardEnabled}
                onChange={(e) => setForwardEnabled(e.target.checked)}
                className="rounded border-slate-600"
              />
              Forward inbound calls to a phone number
            </label>
            <p className="text-xs text-slate-500">
              Ring group takes priority if both are enabled. Disable IVR to use default forward on open hours.
            </p>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Forward to (E.164, e.g. +15551234567)</span>
              <input
                type="tel"
                value={forwardNumber}
                onChange={(e) => setForwardNumber(e.target.value)}
                placeholder="+15551234567"
                className="w-full rounded-lg input-field"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={playGreetingBeforeConnect}
                onChange={(e) => setPlayGreetingBeforeConnect(e.target.checked)}
                className="rounded border-slate-600"
              />
              Play greeting before connecting
            </label>
          </>
        ) : null}

        {tab === 'ring' ? (
          <>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={ringGroupEnabled}
                onChange={(e) => setRingGroupEnabled(e.target.checked)}
                className="rounded border-slate-600"
              />
              Enable ring group (ring multiple numbers on inbound calls)
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Group name</span>
              <input
                type="text"
                value={ringGroupName}
                onChange={(e) => setRingGroupName(e.target.value)}
                placeholder="Main team"
                className="w-full rounded-lg input-field"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm text-slate-700">Ring strategy</span>
                <select
                  value={ringStrategy}
                  onChange={(e) => setRingStrategy(e.target.value as 'simultaneous' | 'sequential')}
                  className="w-full rounded-lg input-field"
                >
                  <option value="simultaneous">Ring all at once</option>
                  <option value="sequential">Ring one after another</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-700">Ring timeout (seconds)</span>
                <input
                  type="number"
                  min={10}
                  max={60}
                  value={ringTimeout}
                  onChange={(e) => setRingTimeout(Number(e.target.value))}
                  className="w-full rounded-lg input-field"
                />
              </label>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-slate-700">Members</p>
              {ringGroupMembers.map((member, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-white/50 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      value={member.label}
                      onChange={(e) => updateRingMember(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="input-field text-sm !py-1 !px-2"
                    />
                    <select
                      value={member.type || 'phone'}
                      onChange={(e) => updateRingMember(index, 'type', e.target.value)}
                      className="input-field text-sm !py-1 !px-2"
                    >
                      <option value="phone">Phone number</option>
                      <option value="app">Mobile / web softphone</option>
                    </select>
                  </div>
                  {(member.type || 'phone') === 'app' ? (
                    <select
                      value={member.userId || ''}
                      onChange={(e) => updateRingMember(index, 'userId', e.target.value)}
                      className="input-field text-sm !py-1 !px-2"
                    >
                      <option value="">Select team member…</option>
                      {teamUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="tel"
                      value={member.phone || ''}
                      onChange={(e) => updateRingMember(index, 'phone', e.target.value)}
                      placeholder="+15551234567"
                      className="input-field text-sm !py-1 !px-2"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setRingGroupMembers((prev) => [
                  ...prev,
                  { type: 'phone', phone: '', label: `Agent ${prev.length + 1}` },
                ])
              }
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              + Add member
            </button>
            <p className="text-xs text-slate-500">
              Softphone members must keep the Softphone page open (or mobile app connected). Requires Call Control
              application ID in Admin → Platform settings and <code className="text-slate-600">API_PUBLIC_URL</code>.
            </p>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">No-answer message (before voicemail)</span>
              <textarea
                rows={2}
                value={noAnswerMessage}
                onChange={(e) => setNoAnswerMessage(e.target.value)}
                placeholder="Sorry, no one is available at {company} right now."
                className="w-full rounded-lg input-field"
              />
            </label>
            {noAnswerPreview ? <p className="text-sm text-slate-500">Preview: {noAnswerPreview}</p> : null}
          </>
        ) : null}

        {tab === 'voicemail' ? (
          <>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={voicemailEnabled}
                onChange={(e) => setVoicemailEnabled(e.target.checked)}
                className="rounded border-slate-600"
              />
              Offer voicemail when forward/ring group does not answer
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Voicemail prompt</span>
              <textarea
                rows={3}
                value={voicemailPrompt}
                onChange={(e) => setVoicemailPrompt(e.target.value)}
                placeholder="Sorry we missed your call at {company}. Please leave a message after the beep."
                className="w-full rounded-lg input-field"
              />
            </label>
            {voicemailPromptPreview ? (
              <p className="text-sm text-slate-500">Preview: {voicemailPromptPreview}</p>
            ) : null}
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Max recording length (seconds)</span>
              <input
                type="number"
                min={30}
                max={600}
                value={voicemailMaxLength}
                onChange={(e) => setVoicemailMaxLength(Number(e.target.value))}
                className="w-full max-w-xs rounded-lg input-field"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={afterHoursVoicemailEnabled}
                onChange={(e) => setAfterHoursVoicemailEnabled(e.target.checked)}
                className="rounded border-slate-600"
              />
              Allow voicemail after hours (instead of hangup only)
            </label>
            <p className="text-xs text-slate-500">
              Recordings appear in Voicemail in the sidebar. Requires call forward or ring group for open-hours no-answer flow.
            </p>
          </>
        ) : null}

        {tab === 'recording' ? (
          <>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={callRecordingEnabled}
                onChange={(e) => setCallRecordingEnabled(e.target.checked)}
                className="rounded border-slate-600"
              />
              Record answered calls (forward / ring group)
            </label>
            <p className="text-xs text-slate-500">
              Dual-channel recording starts when someone answers. Saved recordings appear under Recordings in the sidebar.
            </p>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={playCallRecordingNotice}
                onChange={(e) => setPlayCallRecordingNotice(e.target.checked)}
                className="rounded border-slate-600"
              />
              Play recording notice before connecting
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">Recording notice</span>
              <textarea
                rows={2}
                value={callRecordingNotice}
                onChange={(e) => setCallRecordingNotice(e.target.value)}
                placeholder="This call may be recorded for quality and training purposes."
                className="w-full rounded-lg input-field"
              />
            </label>
            {callRecordingNoticePreview ? (
              <p className="text-sm text-slate-500">Preview: {callRecordingNoticePreview}</p>
            ) : null}
          </>
        ) : null}

        {tab === 'hours' ? (
          <>
            <div
              className={`rounded-lg border p-4 text-sm ${
                businessHoursEnabled
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-900'
              }`}
            >
              {businessHoursEnabled ? (
                <p>
                  <strong>Business hours are ON.</strong> Callers outside your schedule hear the
                  after-hours message (and optional voicemail). Inbound calls will not ring your
                  team outside open hours.
                </p>
              ) : (
                <p>
                  <strong>Business hours are OFF.</strong> Inbound calls follow your ring group /
                  forward rules <strong>24 hours a day, 7 days a week</strong> — including nights
                  and weekends.
                </p>
              )}
            </div>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={businessHoursEnabled}
                onChange={(e) => setBusinessHoursEnabled(e.target.checked)}
                className="rounded border-slate-600"
              />
              Restrict inbound calls to business hours only
            </label>
            <p className="text-xs text-slate-500">
              Turn this <strong>off</strong> if your team answers calls outside normal hours (evenings,
              weekends, on-call). Turn it <strong>on</strong> only when you want after-hours callers to
              hear a closed message instead of ringing agents.
            </p>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">After-hours message</span>
              <textarea
                rows={3}
                value={afterHoursMessage}
                onChange={(e) => setAfterHoursMessage(e.target.value)}
                placeholder="Thank you for calling {company}. We are currently closed."
                className="w-full rounded-lg input-field"
              />
            </label>
            {afterHoursPreview ? (
              <p className="text-sm text-slate-500">Preview: {afterHoursPreview}</p>
            ) : null}
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Weekly schedule{' '}
                {businessHoursEnabled ? (
                  <span className="text-slate-500">(only applies when restriction above is enabled)</span>
                ) : (
                  <span className="text-slate-400">(ignored while business hours are off)</span>
                )}
              </p>
              {Object.keys(DAY_LABELS).map((day) => (
                <div
                  key={day}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-white/50 p-3 sm:grid-cols-[120px_1fr_1fr_auto]"
                >
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={businessHours[day]?.enabled ?? false}
                      onChange={(e) => updateHourDay(day, 'enabled', e.target.checked)}
                    />
                    {DAY_LABELS[day]}
                  </label>
                  <input
                    type="time"
                    value={businessHours[day]?.open || '09:00'}
                    onChange={(e) => updateHourDay(day, 'open', e.target.value)}
                    className="input-field text-sm !py-1 !px-2"
                  />
                  <input
                    type="time"
                    value={businessHours[day]?.close || '17:00'}
                    onChange={(e) => updateHourDay(day, 'close', e.target.value)}
                    className="input-field text-sm !py-1 !px-2"
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'ivr' ? (
          <>
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={ivrEnabled}
                onChange={(e) => setIvrEnabled(e.target.checked)}
                className="rounded border-slate-600"
              />
              Enable IVR menu (press 1, 2, … during open hours)
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-700">IVR intro</span>
              <input
                type="text"
                value={ivrPrompt}
                onChange={(e) => setIvrPrompt(e.target.value)}
                placeholder="Welcome to {company}."
                className="w-full rounded-lg input-field"
              />
            </label>
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <p className="text-sm font-medium text-slate-800">IVR prompt audio (optional)</p>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => onUploadAudio('ivrPromptAudioUrl', e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600"
              />
              {uploadingAudio === 'ivr' ? <p className="text-xs text-indigo-600">Uploading…</p> : null}
              {ivrPromptAudioUrl ? <audio controls src={ivrPromptAudioUrl} className="w-full max-w-md" /> : null}
            </div>
            <div className="space-y-3">
              {ivrOptions.map((option, index) => (
                <div key={index} className="rounded-lg border border-slate-200 bg-white/50 p-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      type="text"
                      maxLength={1}
                      value={option.digit}
                      onChange={(e) => updateIvrOption(index, 'digit', e.target.value.replace(/\D/g, ''))}
                      placeholder="Digit"
                      className="input-field text-sm !py-1 !px-2"
                    />
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => updateIvrOption(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="input-field text-sm !py-1 !px-2 sm:col-span-2"
                    />
                  </div>
                  <select
                    value={option.action}
                    onChange={(e) => updateIvrOption(index, 'action', e.target.value)}
                    className="w-full input-field text-sm !py-1 !px-2"
                  >
                    <option value="message">Play message</option>
                    <option value="forward">Forward to number</option>
                    <option value="ring_group">Ring group</option>
                  </select>
                  {option.action === 'message' ? (
                    <input
                      type="text"
                      value={option.message}
                      onChange={(e) => updateIvrOption(index, 'message', e.target.value)}
                      placeholder="Message when selected"
                      className="w-full input-field text-sm !py-1 !px-2"
                    />
                  ) : null}
                  {option.action === 'forward' ? (
                    <input
                      type="tel"
                      value={option.forwardTo}
                      onChange={(e) => updateIvrOption(index, 'forwardTo', e.target.value)}
                      placeholder="+15551234567"
                      className="w-full input-field text-sm !py-1 !px-2"
                    />
                  ) : null}
                  {option.action === 'ring_group' ? (
                    <p className="text-xs text-slate-500">Uses the ring group configured in the Ring group tab.</p>
                  ) : null}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setIvrOptions((prev) => [
                  ...prev,
                  {
                    digit: String(prev.length + 1),
                    label: 'Option',
                    action: 'message',
                    message: '',
                    forwardTo: '',
                  },
                ])
              }
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              + Add menu option
            </button>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm text-indigo-400">Saved — call your number to test</p> : null}

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-indigo-500 px-4 py-2.5 font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save call routing'}
        </button>
      </div>
    </div>
  );
}
