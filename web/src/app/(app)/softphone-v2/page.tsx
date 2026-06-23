'use client';

import { useEffect, useRef, useState } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import type { Call } from '@telnyx/webrtc';
import { getSoftphoneConfig, getSoftphoneToken } from '@/lib/api';
import { TenantOnlyGate } from '@/components/tenant-only-gate';

const REMOTE_AUDIO_ID = 'softphone-v2-remote';

function logTelnyx(event: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`[softphone-v2] ${event}`);
    return;
  }
  console.log(`[softphone-v2] ${event}`, payload);
}

function normalizeDestination(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function SoftphoneV2Content() {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const callRef = useRef<Call | null>(null);

  const [destination, setDestination] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [status, setStatus] = useState('Initializing…');

  useEffect(() => {
    let mounted = true;
    let client: TelnyxRTC | null = null;

    async function boot() {
      try {
        logTelnyx('boot.start');

        const config = await getSoftphoneConfig();
        const callerId = config.defaultCallerId || config.numbers[0]?.number || '';
        if (!callerId) {
          if (mounted) setStatus('No caller ID — assign a tenant number first');
          logTelnyx('boot.no-caller-id');
          return;
        }
        if (mounted) setCallerNumber(callerId);

        const tokenRes = await getSoftphoneToken();
        logTelnyx('boot.token', {
          sipUsername: tokenRes.sipUsername,
          expiresInSeconds: tokenRes.expiresInSeconds,
          loginTokenLength: tokenRes.loginToken?.trim().length ?? 0,
        });

        if (!tokenRes.loginToken?.trim()) {
          if (mounted) setStatus('Empty login token from /api/softphone/token');
          logTelnyx('boot.empty-token');
          return;
        }

        client = new TelnyxRTC({
          login_token: tokenRes.loginToken.trim(),
          debug: true,
        });

        const audioEl = document.getElementById(REMOTE_AUDIO_ID) as HTMLAudioElement | null;
        if (audioEl) {
          (client as TelnyxRTC & { remoteElement?: HTMLMediaElement }).remoteElement = audioEl;
          logTelnyx('boot.remote-audio-bound', { id: audioEl.id });
        } else {
          logTelnyx('boot.remote-audio-missing');
        }

        client.on('telnyx.ready', () => {
          logTelnyx('telnyx.ready');
          if (mounted) setStatus('Ready — open DevTools console for all Telnyx events');
        });

        client.on('telnyx.notification', (notification: unknown) => {
          logTelnyx('telnyx.notification', notification);
          const payload = notification as { type?: string; call?: Call };
          if (payload.call) {
            callRef.current = payload.call;
            logTelnyx('telnyx.notification.call', {
              type: payload.type,
              id: payload.call.id,
              state: payload.call.state,
            });
          }
        });

        client.on('telnyx.error', (event: unknown) => {
          logTelnyx('telnyx.error', event);
          if (mounted) {
            setStatus(`Telnyx error — see console`);
          }
        });

        clientRef.current = client;
        if (mounted) setStatus('Connecting…');
        logTelnyx('boot.connect');
        client.connect();
      } catch (err) {
        logTelnyx('boot.error', err);
        if (mounted) {
          setStatus(err instanceof Error ? err.message : 'Boot failed');
        }
      }
    }

    void boot();

    return () => {
      mounted = false;
      logTelnyx('boot.cleanup');
      try {
        callRef.current?.hangup();
        client?.disconnect();
      } catch (err) {
        logTelnyx('boot.cleanup.error', err);
      }
      clientRef.current = null;
      callRef.current = null;
    };
  }, []);

  const onCall = () => {
    const client = clientRef.current;
    const destinationNumber = normalizeDestination(destination);
    logTelnyx('call.click', { destinationNumber, callerNumber });

    if (!client) {
      logTelnyx('call.blocked', 'no client');
      return;
    }
    if (!destinationNumber) {
      logTelnyx('call.blocked', 'empty destination');
      return;
    }
    if (!callerNumber) {
      logTelnyx('call.blocked', 'empty callerNumber');
      return;
    }

    try {
      const call = client.newCall({
        destinationNumber,
        callerNumber,
      });
      callRef.current = call;
      logTelnyx('newCall.returned', {
        id: call.id,
        state: call.state,
        keys: Object.keys(call as object),
      });
    } catch (err) {
      logTelnyx('newCall.error', err);
    }
  };

  const onAnswer = () => {
    const call = callRef.current;
    logTelnyx('answer.click', call ? { id: call.id, state: call.state } : null);
    if (!call) return;
    try {
      call.answer();
      logTelnyx('answer.invoked');
    } catch (err) {
      logTelnyx('answer.error', err);
    }
  };

  const onHangup = () => {
    const call = callRef.current;
    logTelnyx('hangup.click', call ? { id: call.id, state: call.state } : null);
    if (!call) return;
    try {
      void Promise.resolve(call.hangup()).then(() => {
        logTelnyx('hangup.resolved');
      });
    } catch (err) {
      logTelnyx('hangup.error', err);
    }
    callRef.current = null;
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Softphone v2 (minimal TelnyxRTC)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Pure SDK test — filter console with <code className="text-xs">softphone-v2</code>
        </p>
      </div>

      <p className="text-sm text-slate-700">{status}</p>

      <div className="space-y-1">
        <label htmlFor="softphone-v2-destination" className="text-sm font-medium text-slate-700">
          Destination number
        </label>
        <input
          id="softphone-v2-destination"
          type="tel"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="+15551234567"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
        />
      </div>

      {callerNumber ? (
        <p className="text-xs text-slate-500">
          Caller ID: <span className="font-mono">{callerNumber}</span> (from /api/softphone/config)
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCall}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Call
        </button>
        <button
          type="button"
          onClick={onAnswer}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Answer
        </button>
        <button
          type="button"
          onClick={onHangup}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Hangup
        </button>
      </div>

      <audio
        id={REMOTE_AUDIO_ID}
        autoPlay
        playsInline
        className="sr-only"
        aria-hidden
      />
    </div>
  );
}

export default function SoftphoneV2Page() {
  return (
    <TenantOnlyGate featureName="Softphone v2">
      <SoftphoneV2Content />
    </TenantOnlyGate>
  );
}
