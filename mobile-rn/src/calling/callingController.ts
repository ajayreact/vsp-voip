import type { Call } from '@telnyx/react-voice-commons-sdk';
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';
import { fetchContacts } from '../contacts/contactsService';
import { useCallingStore, type CallSessionSnapshot } from '../store/callingStore';
import { setSpeakerEnabled, startCallAudio, stopCallAudio } from './audioRoute';
import { resolveInboundCallIdentity, resolveLiveCallerIdentity } from './callerIdentity';
import { getTelnyxVoipClient } from './telnyxVoip';
import { isActiveCallState, isIncomingRinging, mapTelnyxCallToInboundFields } from './telnyxCallMapping';
import { normalizeDestination } from './dialNormalization';

let contactsCache: Awaited<ReturnType<typeof fetchContacts>> = [];

async function ensureContacts() {
  if (contactsCache.length) return contactsCache;
  try {
    contactsCache = await fetchContacts();
  } catch {
    contactsCache = [];
  }
  return contactsCache;
}

function buildSnapshot(call: Call, ownNumbers: string[]): CallSessionSnapshot {
  const fields = call.isIncoming
    ? mapTelnyxCallToInboundFields(call)
    : {
        direction: 'outbound',
        remotePartyNumber: call.destination,
      };
  const identity = call.isIncoming
    ? resolveInboundCallIdentity(fields, ownNumbers, contactsCache).identity
    : resolveLiveCallerIdentity(normalizeDestination(call.destination), contactsCache);

  return {
    call,
    callId: call.callId,
    state: call.currentState,
    isMuted: call.currentIsMuted,
    isHeld: call.currentIsHeld,
    duration: call.currentDuration,
    isIncoming: call.isIncoming,
    identity,
    showKeypad: false,
    lastDtmf: '',
    speakerOn: false,
  };
}

export async function refreshCallSnapshot(call: Call) {
  const ownNumbers = useCallingStore.getState().tenantNumbers;
  await ensureContacts();
  const snapshot = buildSnapshot(call, ownNumbers);
  if (isIncomingRinging(call)) {
    useCallingStore.getState().setIncomingCall(snapshot);
    return;
  }
  if (isActiveCallState(call.currentState) || call.currentState === TelnyxCallState.RINGING) {
    useCallingStore.getState().setIncomingCall(null);
    useCallingStore.getState().setActiveCall(snapshot);
    if (call.currentState === TelnyxCallState.ACTIVE) {
      startCallAudio();
    }
    return;
  }
  if (
    call.currentState === TelnyxCallState.ENDED
    || call.currentState === TelnyxCallState.FAILED
    || call.currentState === TelnyxCallState.DROPPED
  ) {
    stopCallAudio();
    useCallingStore.getState().resetCalls();
  }
}

export async function placeOutboundCall(destination: string) {
  const client = getTelnyxVoipClient();
  const { defaultCallerId, tenantNumbers } = useCallingStore.getState();
  const normalized = normalizeDestination(destination);
  if (!normalized) throw new Error('Enter a valid phone number or extension.');
  const callerNumber = defaultCallerId || tenantNumbers[0] || undefined;
  await ensureContacts();
  const call = await client.newCall(normalized, undefined, callerNumber);
  await refreshCallSnapshot(call);
  return call;
}

export async function answerIncomingCall() {
  const incoming = useCallingStore.getState().incomingCall;
  if (!incoming) return;
  await incoming.call.answer();
  startCallAudio();
}

export async function declineIncomingCall() {
  const incoming = useCallingStore.getState().incomingCall;
  if (!incoming) return;
  await incoming.call.hangup();
  useCallingStore.getState().setIncomingCall(null);
}

export async function hangupActiveCall() {
  const active = useCallingStore.getState().activeCall;
  const incoming = useCallingStore.getState().incomingCall;
  const target = active?.call ?? incoming?.call;
  if (!target) return;
  await target.hangup();
  stopCallAudio();
  useCallingStore.getState().resetCalls();
}

export async function toggleMute() {
  const active = useCallingStore.getState().activeCall;
  if (!active) return;
  await active.call.toggleMute();
  useCallingStore.getState().patchActiveCall({ isMuted: active.call.currentIsMuted });
}

export async function toggleHold() {
  const active = useCallingStore.getState().activeCall;
  if (!active) return;
  if (active.call.currentIsHeld) {
    await active.call.resume();
  } else {
    await active.call.hold();
  }
  useCallingStore.getState().patchActiveCall({
    isHeld: active.call.currentIsHeld,
    state: active.call.currentState,
  });
}

export function toggleSpeaker() {
  const active = useCallingStore.getState().activeCall;
  if (!active) return;
  const next = !active.speakerOn;
  setSpeakerEnabled(next);
  useCallingStore.getState().patchActiveCall({ speakerOn: next });
}

export function toggleInCallKeypad() {
  const active = useCallingStore.getState().activeCall;
  if (!active) return;
  useCallingStore.getState().patchActiveCall({ showKeypad: !active.showKeypad });
}

export async function sendDtmf(digit: string) {
  const active = useCallingStore.getState().activeCall;
  if (!active) return;
  await active.call.dtmf(digit);
  useCallingStore.getState().patchActiveCall({
    lastDtmf: `${active.lastDtmf}${digit}`.slice(-12),
  });
}

export function bindCallStreams(call: Call, ownNumbers: string[]) {
  const subs = [
    call.callState$.subscribe(() => {
      void refreshCallSnapshot(call);
    }),
    call.isMuted$.subscribe((isMuted) => {
      const { activeCall, incomingCall } = useCallingStore.getState();
      if (activeCall?.callId === call.callId) {
        useCallingStore.getState().patchActiveCall({ isMuted });
      }
      if (incomingCall?.callId === call.callId) {
        useCallingStore.getState().patchIncomingCall({ isMuted });
      }
    }),
    call.isHeld$.subscribe((isHeld) => {
      useCallingStore.getState().patchActiveCall({
        isHeld,
        state: call.currentState,
      });
    }),
    call.duration$.subscribe((duration) => {
      useCallingStore.getState().patchActiveCall({ duration });
    }),
  ];

  void ensureContacts().then(() => refreshCallSnapshot(call));
  return () => subs.forEach((sub) => sub.unsubscribe());
}

export function clearContactsCache() {
  contactsCache = [];
}
