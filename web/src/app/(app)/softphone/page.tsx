'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TelnyxRTC } from '@telnyx/webrtc';
import type { Call } from '@telnyx/webrtc';
import {
  getSoftphoneConfig,
  getSoftphoneToken,
  isUnauthorizedError,
  logSoftphoneCall,
  setSoftphonePresence,
  startSoftphoneRecording,
} from '@/lib/api';
import { TenantOnlyGate } from '@/components/tenant-only-gate';
import {
  playOutboundRingback,
  primeCallAudio,
  startIncomingRingtone,
  stopAllCallSounds,
  stopIncomingRingtone,
} from '@/lib/call-sounds';
import {
  attachRemoteCallAudio,
  detachRemoteCallAudio,
  wireWebCallAudio,
} from '@/lib/webrtc-audio';

type UiState = 'loading' | 'not-configured' | 'no-numbers' | 'connecting' | 'ready' | 'incoming' | 'calling' | 'active' | 'error';

const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
const EXTENSION_DIAL_PATTERN = /^\d{2,6}$/;

function isExtensionDialInput(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  return EXTENSION_DIAL_PATTERN.test(digits);
}

function isPstnDialInput(value: string) {
  const digits = value.trim().replace(/\D/g, '');
  return digits.length >= 10;
}

type TelnyxErrorEvent = {
  error?: {
    message?: string;
    description?: string;
    code?: number;
    name?: string;
  };
  sessionId?: string;
  recoverable?: boolean;
};

function formatTelnyxError(event: unknown) {
  if (!event || typeof event !== 'object') return 'Softphone connection failed';
  const payload = event as TelnyxErrorEvent;
  if (payload.error?.message) return payload.error.message;
  if (payload.error?.description) return payload.error.description;
  if (payload.error?.name) return payload.error.name;
  if ('message' in event && typeof (event as Error).message === 'string') {
    return (event as Error).message;
  }
  return 'Softphone connection failed';
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access is not available in this browser');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function formatCallDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function SoftphonePage() {
  return (
    <TenantOnlyGate featureName="Softphone">
      <SoftphoneContent />
    </TenantOnlyGate>
  );
}

function SoftphoneContent() {
  const clientRef = useRef<TelnyxRTC | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callerIdRef = useRef('');
  const destinationRef = useRef('');
  const recordingStartedRef = useRef(false);

  const [uiState, setUiState] = useState<UiState>('loading');
  const [status, setStatus] = useState('Starting softphone…');
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('');
  const [callerId, setCallerId] = useState('');
  const [numbers, setNumbers] = useState<{ id: string; number: string }[]>([]);
  const [callRecordingEnabled, setCallRecordingEnabled] = useState(true);
  const [voiceWebhookUrl, setVoiceWebhookUrl] = useState('');
  const [callControlHint, setCallControlHint] = useState('');
  const [incomingFrom, setIncomingFrom] = useState('');
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [callRecordingActive, setCallRecordingActive] = useState(false);
  const callRecordingEnabledRef = useRef(true);
  const bootGenerationRef = useRef(0);
  const tearingDownRef = useRef(false);
  const unwireCallAudioRef = useRef<(() => void) | null>(null);
  const audioPrimedRef = useRef(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);

  useEffect(() => {
    if (uiState !== 'active') {
      setCallElapsedSeconds(0);
      return undefined;
    }

    setCallElapsedSeconds(0);
    const timerId = window.setInterval(() => {
      setCallElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [uiState]);

  useEffect(() => {
    callerIdRef.current = callerId;
  }, [callerId]);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  useEffect(() => {
    callRecordingEnabledRef.current = callRecordingEnabled;
  }, [callRecordingEnabled]);

  useEffect(() => {
    if (uiState === 'incoming') {
      void startIncomingRingtone();
      return () => {
        stopIncomingRingtone();
      };
    }
    stopIncomingRingtone();
    return undefined;
  }, [uiState]);

  const ensureAudioPrimed = useCallback(async () => {
    if (audioPrimedRef.current) return;
    await primeCallAudio(remoteAudioRef.current);
    audioPrimedRef.current = true;
  }, []);

  useEffect(() => {
    const generation = ++bootGenerationRef.current;
    tearingDownRef.current = false;
    let mounted = true;
    let client: TelnyxRTC | null = null;

    async function boot() {
      try {
        setUiState('loading');
        setStatus('Starting softphone…');
        setError('');

        const config = await getSoftphoneConfig();
        if (!mounted || generation !== bootGenerationRef.current) return;

        setNumbers(config.numbers);
        setCallRecordingEnabled(config.callRecordingEnabled);
        callRecordingEnabledRef.current = config.callRecordingEnabled;
        setVoiceWebhookUrl(config.voiceWebhookUrl || '');
        setCallControlHint(config.callControlSetup?.message || '');
        const defaultId = config.defaultCallerId || config.numbers[0]?.number || '';
        setCallerId(defaultId);
        callerIdRef.current = defaultId;

        if (!config.configured) {
          setUiState('not-configured');
          setStatus('WebRTC credential connection is not configured');
          return;
        }
        if (!config.numbers.length) {
          setUiState('no-numbers');
          setStatus('Assign a phone number before placing calls');
          return;
        }

        setUiState('connecting');
        setStatus('Requesting secure login token…');
        const tokenRes = await getSoftphoneToken();
        if (!mounted || generation !== bootGenerationRef.current) return;

        client = new TelnyxRTC({ login_token: tokenRes.loginToken });
        client.remoteElement = 'softphone-remote-audio';
        clientRef.current = client;

        client.on('telnyx.ready', () => {
          if (!mounted || generation !== bootGenerationRef.current || tearingDownRef.current) return;
          setUiState('ready');
          setStatus('Connected — ready for inbound and outbound calls');
          setError('');
          setSoftphonePresence(true).catch(() => {});
        });

        client.on('telnyx.error', (event: unknown) => {
          if (!mounted || generation !== bootGenerationRef.current || tearingDownRef.current) return;
          console.error('Telnyx softphone error:', event);
          setUiState('error');
          setError(formatTelnyxError(event));
        });

        client.on('telnyx.notification', (notification: { type: string; call?: Call }) => {
          if (notification.type !== 'callUpdate' || !notification.call) return;
          if (generation !== bootGenerationRef.current) return;
          const call = notification.call;
          activeCallRef.current = call;
          const inbound = String((call as Call & { direction?: string }).direction || '').toLowerCase() === 'inbound';
          const remoteNumber =
            (call as Call & { options?: { remoteCallerNumber?: string } }).options?.remoteCallerNumber || '';

          if (call.state === 'ringing' || call.state === 'trying') {
            if (inbound) {
              setIncomingFrom(remoteNumber || 'Unknown caller');
              setUiState('incoming');
              setStatus(`Incoming call from ${remoteNumber || 'unknown'}`);
            } else {
              setUiState('calling');
              setStatus(`Calling ${destinationRef.current || '…'}`);
              void playOutboundRingback(call);
            }
          }
          if (call.state === 'active') {
            stopAllCallSounds();
            call.stopRingback?.();
            unwireCallAudioRef.current?.();
            unwireCallAudioRef.current = wireWebCallAudio(
              call,
              remoteAudioRef.current,
              () => setAudioBlocked(true),
            );
            setUiState('active');
            setStatus(inbound ? `In call with ${remoteNumber || incomingFrom}` : 'Call in progress');
            setCallRecordingActive(false);
            const logFrom = inbound ? remoteNumber || incomingFrom : callerIdRef.current;
            const logTo = inbound ? callerIdRef.current || remoteNumber : destinationRef.current;
            if (
              callRecordingEnabledRef.current
              && !recordingStartedRef.current
              && logFrom
              && logTo
            ) {
              const callControlId = call.telnyxIDs?.telnyxCallControlId;
              if (callControlId) {
                recordingStartedRef.current = true;
                startSoftphoneRecording({
                  callControlId,
                  from: logFrom,
                  to: logTo,
                })
                  .then(() => {
                    setCallRecordingActive(true);
                  })
                  .catch((err) => {
                    console.error(err);
                    recordingStartedRef.current = false;
                  });
              }
            }
          }
          if (call.state === 'hangup' || call.state === 'destroy') {
            stopAllCallSounds();
            call.stopRingback?.();
            unwireCallAudioRef.current?.();
            unwireCallAudioRef.current = null;
            detachRemoteCallAudio(remoteAudioRef.current);
            setAudioBlocked(false);
            setStatus('Call ended');
            recordingStartedRef.current = false;
            setCallRecordingActive(false);
            const logFrom = inbound ? remoteNumber || incomingFrom : callerIdRef.current;
            const logTo = inbound ? callerIdRef.current : destinationRef.current;
            if (logFrom && logTo) {
              logSoftphoneCall({
                callSid: call.id,
                from: logFrom,
                to: logTo,
                status: 'completed',
              }).catch(() => {});
            }
            activeCallRef.current = null;
            setIncomingFrom('');
            if (mounted && generation === bootGenerationRef.current) {
              setUiState('ready');
              setStatus('Connected — ready for inbound and outbound calls');
            }
          }
        });

        setStatus('Connecting to Telnyx…');
        client.connect();
      } catch (err) {
        if (!mounted || generation !== bootGenerationRef.current) return;
        if (!isUnauthorizedError(err)) {
          setUiState('error');
          setError(err instanceof Error ? err.message : 'Could not start softphone');
        }
      }
    }

    boot();

    return () => {
      mounted = false;
      tearingDownRef.current = true;
      stopAllCallSounds();
      setSoftphonePresence(false).catch(() => {});
      try {
        activeCallRef.current?.hangup();
        client?.disconnect();
        if (clientRef.current === client) {
          clientRef.current = null;
        }
      } catch {
        /* ignore cleanup errors */
      }
    };
  }, [bootAttempt]);

  useEffect(() => {
    if (uiState !== 'ready' && uiState !== 'incoming' && uiState !== 'active' && uiState !== 'calling') {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSoftphonePresence(true).catch(() => {});
    }, 2 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [uiState]);

  const appendDigit = useCallback((digit: string) => {
    void ensureAudioPrimed();
    setDestination((prev) => prev + digit);
  }, [ensureAudioPrimed]);

  const onCall = useCallback(async () => {
    const client = clientRef.current;
    const dest = destination.trim();
    if (!client || !dest || !callerId) return;

    setError('');
    setUiState('calling');
    recordingStartedRef.current = false;
    setCallRecordingActive(false);

    const extensionDigits = dest.replace(/\D/g, '');
    const isExtension = isExtensionDialInput(dest);

    setStatus(isExtension ? `Calling ext ${extensionDigits}…` : `Calling ${dest}…`);

    try {
      await ensureMicrophoneAccess();
      await ensureAudioPrimed();
    } catch (err) {
      setUiState('ready');
      setStatus('Connected — enter a number and press Call');
      setError(err instanceof Error ? err.message : 'Microphone permission is required for calls');
      return;
    }

    if (isExtension) {
      const call = client.newCall({
        destinationNumber: extensionDigits,
        callerNumber: callerId,
        audio: true,
        remoteElement: 'softphone-remote-audio',
      });
      activeCallRef.current = call;
      return;
    }

    const call = client.newCall({
      destinationNumber: dest.startsWith('+') ? dest : `+${dest.replace(/\D/g, '')}`,
      callerNumber: callerId,
      audio: true,
      remoteElement: 'softphone-remote-audio',
    });
    activeCallRef.current = call;
  }, [destination, callerId, ensureAudioPrimed]);

  const onEnableAudio = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    await ensureAudioPrimed();
    const playing = await attachRemoteCallAudio(call, remoteAudioRef.current);
    if (playing) setAudioBlocked(false);
  }, [ensureAudioPrimed]);

  const onHangup = useCallback(() => {
    stopAllCallSounds();
    activeCallRef.current?.hangup();
  }, []);

  const onAnswer = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call) return;
    try {
      stopIncomingRingtone();
      await ensureMicrophoneAccess();
      await ensureAudioPrimed();
      call.answer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone permission is required');
    }
  }, [ensureAudioPrimed]);

  const onReject = useCallback(() => {
    stopAllCallSounds();
    activeCallRef.current?.hangup();
    setIncomingFrom('');
    setUiState('ready');
    setStatus('Connected — ready for inbound and outbound calls');
  }, []);

  const canDial = uiState === 'ready' && (isExtensionDialInput(destination) || isPstnDialInput(destination));
  const inCall = uiState === 'calling' || uiState === 'active' || uiState === 'incoming';

  if (uiState === 'loading') {
    return <div className="py-24 text-center text-slate-400">{status}</div>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Do not use display:none — browsers may block playback on hidden audio elements */}
      <audio
        ref={remoteAudioRef}
        id="softphone-remote-audio"
        autoPlay
        playsInline
        className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
        aria-hidden
      />

      <div>
        <h2 className="text-lg font-medium text-slate-900">Softphone</h2>
        <p className="text-sm text-slate-400">Place and receive calls from your browser using your business numbers.</p>
      </div>

      {callControlHint && !callControlHint.includes('configured') ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {callControlHint}
        </div>
      ) : null}

      {uiState === 'not-configured' ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-900 space-y-2">
          <p>Add a Telnyx <strong>Credential Connection</strong> ID in Admin → Platform settings, or set{' '}
            <code className="text-amber-200">TELNYX_CREDENTIAL_CONNECTION_ID</code> in <code className="text-amber-200">.env</code>.
          </p>
          <p className="text-xs text-amber-200/80">
            This is separate from the TeXML app used for inbound calls. Create it in Telnyx Portal → Voice → Connections → Credential.
          </p>
        </div>
      ) : null}

      {uiState === 'no-numbers' ? (
        <div className="panel-card p-5 text-center text-slate-400">
          <p className="mb-3">You need at least one phone number to call out.</p>
          <Link href="/numbers" className="text-indigo-600 hover:text-indigo-500">
            Buy numbers →
          </Link>
        </div>
      ) : null}

      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          {uiState === 'error' ? (
            <button
              type="button"
              onClick={() => setBootAttempt((value) => value + 1)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Retry connection
            </button>
          ) : null}
        </div>
      ) : null}

      {uiState !== 'not-configured' && uiState !== 'no-numbers' ? (
        <div
          className="panel-card p-6 space-y-4"
          onPointerDown={() => {
            void ensureAudioPrimed();
          }}
        >
          <div className="rounded-lg bg-white px-4 py-2 text-sm text-slate-700">
            {uiState === 'active' ? (
              <div className="flex items-center justify-between gap-3">
                <span>
                  Call in progress
                  {callRecordingActive ? ' · recording' : ''}
                </span>
                <span className="font-mono tabular-nums text-lg text-indigo-400">
                  {formatCallDuration(callElapsedSeconds)}
                </span>
              </div>
            ) : (
              status
            )}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-400">Caller ID</span>
            <select
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              disabled={inCall}
              className="w-full rounded-lg input-field"
            >
              {numbers.map((n) => (
                <option key={n.id} value={n.number}>
                  {n.number}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-400">Destination (extension or E.164)</span>
            <input
              type="tel"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="101 or +15551234567"
              disabled={inCall}
              className="w-full rounded-lg input-field font-mono text-lg"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            {DIAL_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                disabled={inCall}
                onClick={() => appendDigit(key)}
                className="rounded-lg border border-slate-300 bg-white py-3 text-lg font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-40"
              >
                {key}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            {uiState === 'incoming' ? (
              <>
                <button
                  type="button"
                  onClick={onAnswer}
                  className="flex-1 btn-primary px-4 py-2.5 text-sm w-full justify-center"
                >
                  Answer
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="flex-1 rounded-lg bg-red-500 py-3 font-medium text-white hover:bg-red-400"
                >
                  Decline
                </button>
              </>
            ) : !inCall ? (
              <button
                type="button"
                onClick={onCall}
                disabled={!canDial}
                className="flex-1 btn-primary px-4 py-2.5 text-sm w-full justify-center disabled:opacity-40"
              >
                Call
              </button>
            ) : (
              <button
                type="button"
                onClick={onHangup}
                className="flex-1 rounded-lg bg-red-500 py-3 font-medium text-white hover:bg-red-400"
              >
                Hang up
              </button>
            )}
          </div>

          {audioBlocked && uiState === 'active' ? (
            <button
              type="button"
              onClick={onEnableAudio}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Enable speaker audio
            </button>
          ) : null}

          {callRecordingEnabled ? (
            <p className="text-xs text-slate-500">
              Outbound calls are recorded automatically when Call routing → Call recording is enabled.
              Set your Telnyx Credential Connection webhook to{' '}
              <code className="break-all text-slate-400">{voiceWebhookUrl || '/webhook/voice'}</code>{' '}
              so recordings appear in the Recordings inbox.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Call recording is off. Enable it in Call routing → Call recording.
            </p>
          )}
          <p className="text-xs text-slate-500">
            Allow microphone access when prompted. Use headphones to avoid echo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
