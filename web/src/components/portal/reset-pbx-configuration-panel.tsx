'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import 'sweetalert2/dist/sweetalert2.min.css';
import Swal from 'sweetalert2';
import { resetTenantPbxConfiguration } from '@/lib/api';
import { SWAL_THEME } from '@/lib/swal-theme';

const CONFIRMATION_PHRASE = 'RESET PBX';

const REMOVED_ITEMS = [
  'Employees',
  'Extensions',
  'Extension assignments',
  'Ring Groups',
  'Ring Group Members',
  'Device registrations',
  'SIP registrations',
  'QR provisioning tokens',
  'SIP credential assignments',
  'Forwarding rules',
  'Greetings',
  'Business Hours',
  'Contacts',
  'Imported Contacts',
  'Active Sessions',
  'Refresh Tokens',
  'Presence',
  'Device provisioning data',
];

export function ResetPbxConfigurationPanel() {
  const [password, setPassword] = useState('');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [clearCallHistory, setClearCallHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = useMemo(
    () =>
      !submitting
      && password.length > 0
      && confirmationPhrase.trim() === CONFIRMATION_PHRASE,
    [confirmationPhrase, password, submitting],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setError('');
    setSubmitting(true);
    try {
      const result = await resetTenantPbxConfiguration({
        password,
        confirmationPhrase: confirmationPhrase.trim(),
        clearCallHistory,
      });

      await Swal.fire({
        title: 'PBX configuration reset',
        html: `
          <p class="text-sm text-slate-600">Your company PBX has been cleared. Purchased phone numbers remain unassigned.</p>
          <ul class="mt-3 text-left text-sm text-slate-600">
            <li>Employees: ${result.report.counts.employees ?? 0}</li>
            <li>Extensions: ${result.report.counts.extensions ?? 0}</li>
            <li>Available DIDs: ${result.report.counts.phoneNumbers ?? 0}</li>
          </ul>
        `,
        icon: 'success',
        confirmButtonText: 'Continue',
        ...SWAL_THEME,
      });

      setPassword('');
      setConfirmationPhrase('');
      setClearCallHistory(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Reset failed';
      setError(message);
      await Swal.fire({
        title: 'Reset failed',
        text: message,
        icon: 'error',
        ...SWAL_THEME,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel-card border-red-200 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-red-50 p-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium text-slate-900">Reset PBX Configuration</h3>
          <p className="mt-2 text-sm text-slate-600">
            This will remove all PBX configuration for your company.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-red-100 bg-red-50/60 p-4">
        <p className="text-sm font-medium text-red-900">The following will be removed:</p>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {REMOVED_ITEMS.map((item) => (
            <li key={item} className="text-sm text-red-800">
              • {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 space-y-2 text-sm text-slate-600">
        <p>
          <strong className="text-slate-900">Phone numbers will NOT be deleted.</strong>
          {' '}
          Your purchased phone numbers will remain in your account but will become
          {' '}
          <strong className="text-slate-900">Unassigned</strong>.
        </p>
        <p>Call history is preserved by default.</p>
        <p className="font-medium text-red-700">This action cannot be undone.</p>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-xl border border-slate-200 p-4">
        <input
          type="checkbox"
          checked={clearCallHistory}
          onChange={(event) => setClearCallHistory(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
        />
        <span className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">Also delete:</span>
          {' '}
          Call History, Voicemail metadata, Recording metadata, SMS history
        </span>
      </label>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Confirm your password
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="w-full rounded-lg input-field"
            placeholder="Enter your account password"
          />
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Type <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{CONFIRMATION_PHRASE}</code> to confirm
          </span>
          <input
            type="text"
            value={confirmationPhrase}
            onChange={(event) => setConfirmationPhrase(event.target.value)}
            className="w-full rounded-lg input-field"
            placeholder={CONFIRMATION_PHRASE}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Reset PBX Configuration
        </button>
      </div>
    </form>
  );
}
