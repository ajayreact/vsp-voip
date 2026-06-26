import type { Call } from '@telnyx/react-voice-commons-sdk';
import { TelnyxCallState } from '@telnyx/react-voice-commons-sdk';
import { fetchContacts } from '../contacts/contactsService';
import { useCallingStore, type CallSessionSnapshot } from '../store/callingStore';
import { syncCallAudioRoute, startCallAudio, stopCallAudio } from './audioRoute';
import { resolveInboundCallIdentity, resolveLiveCallerIdentity } from './callerIdentity';
import {
  beginTrackedCall,
  clearTrackedCalls,
  finalizeTrackedCall,
  markCallAccepted,
  markCallCancelled,
  markCallDeclined,
  syncTrackedCallState,
  updateTrackedRemoteNumber,
} from './callSessionTracker';
import { postCallAccepted } from './softphoneService';
import { getTelnyxVoipClient } from './telnyxVoip';
import { isActiveCallState, isIncomingRinging, mapTelnyxCallToInboundFields } from './telnyxCallMapping';
import { normalizeDestination } from './dialNormalization';

let contactsCache: Awaited<ReturnType<typeof fetchContacts>> = [];
let contactsLoadedAt = 0;
const CONTACTS_TTL_MS = 5 * 60_000;

async function ensureContacts(force = false) {
  const stale = Date.now() - contactsLoadedAt > CONTACTS_TTL_MS;
  if (!force && contactsCache.length && !stale) return contactsCache;
  try {
    contactsCache = await fetchContacts();
    contactsLoadedAt = Date.now();
  } catch {
    if (!contactsCache.length) contactsCache = [];
  }
  return contactsCache;
}

function mergeUiState(
  previous: CallSessionSnapshot | null,
  base: CallSessionSnapshot,
): CallSessionSnapshot {
  if (!previous || previous.callId !== base.callId) return base;
  return {
    ...base,
    showKeypad: previous.showKeypad,
    lastDtmf: previous.lastDtmf,
    speakerOn: previous.speakerOn,
  };
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
  const state = useCallingStore.getState();
  const ownNumbers = state.tenantNumbers;
  await ensureContacts();
  syncTrackedCallState(call);

  const base = buildSnapshot(call, ownNumbers);

  if (isIncomingRinging(call)) {
    beginTrackedCall(call, 'inbound', call.destination);
    const merged = mergeUiState(state.incomingCall, base);
    state.setIncomingCall(merged);
    return;
  }

  if (isActiveCallState(call.currentState) || call.currentState === TelnyxCallState.RINGING) {
    if (!useCallingStore.getState().activeCall && call.currentState === TelnyxCallState.RINGING && call.isOutgoing) {
      beginTrackedCall(call, 'outbound', call.destination);
    }
    const merged = mergeUiState(state.activeCall, base);
    state.setIncomingCall(null);
    state.setActiveCall(merged);
    if (call.currentState === TelnyxCallState.ACTIVE) {
      startCallAudio(merged.speakerOn);
      syncCallAudioRoute(merged.speakerOn);
    }
    return;
  }

  if (
    call.currentState === TelnyxCallState.ENDED
    || call.currentState === TelnyxCallState.FAILED
    || call.currentState === TelnyxCallState.DROPPED
  ) {
    finalizeTrackedCall(call, call.currentDuration);
    stopCallAudio();
    state.resetCalls();
  }
}

export async function placeOutboundCall(destination: string) {
  const client = getTelnyxVoipClient();
  const { defaultCallerId, tenantNumbers } = useCallingStore.getState();
  const normalized = normalizeDestination(destination);
  if (!normalized) throw new Error('Enter a valid phone number or extension.');
  const callerNumber = defaultCallerId || tenantNumbers[0] || undefined;
  await ensureContacts(true);
  const call = await client.newCall(normalized, undefined, callerNumber);
  beginTrackedCall(call, 'outbound', normalized);
  await refreshCallSnapshot(call);
  return call;
}

export async function answerIncomingCall() {
  const incoming = useCallingStore.getState().incomingCall;
  if (!incoming) return;

  markCallAccepted(incoming.callId);

  void postCallAccepted().then((result) => {
    const pstnCaller = result.pstnCaller?.trim();
    if (!pstnCaller) return;
    updateTrackedRemoteNumber(incoming.callId, pstnCaller);
    const { tenantNumbers } = useCallingStore.getState();
    void ensureContacts().then(() => {
      const fields = mapTelnyxCallToInboundFields(incoming.call);
      fields.remotePartyNumber = pstnCaller;
      const { identity } = resolveInboundCallIdentity(fields, tenantNumbers, contactsCache);
      const active = useCallingStore.getState().activeCall;
      if (active?.callId === incoming.callId) {
        useCallingStore.getState().patchActiveCall({ identity });
      }
    });
  }).catch(() => {});

  await incoming.call.answer();
  const speakerOn = incoming.speakerOn;
  startCallAudio(speakerOn);
  syncCallAudioRoute(speakerOn);
}

export async function declineIncomingCall() {
  const incoming = useCallingStore.getState().incomingCall;
  if (!incoming) return;
  markCallDeclined(incoming.callId);
  await incoming.call.hangup();
  finalizeTrackedCall(incoming.call, 0);
  useCallingStore.getState().setIncomingCall(null);
}

export async function hangupActiveCall() {
  const active = useCallingStore.getState().activeCall;
  const incoming = useCallingStore.getState().incomingCall;
  const target = active?.call ?? incoming?.call;
  if (!target) return;
  if (active && !active.isIncoming && active.state === TelnyxCallState.RINGING) {
    markCallCancelled(target.callId);
  }
  await target.hangup();
  finalizeTrackedCall(target, target.currentDuration);
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
  syncCallAudioRoute(next);
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

export function bindCallStreams(call: Call) {
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
      const { activeCall } = useCallingStore.getState();
      if (activeCall?.callId !== call.callId) return;
      useCallingStore.getState().patchActiveCall({
        isHeld,
        state: call.currentState,
      });
    }),
    call.duration$.subscribe((duration) => {
      const { activeCall } = useCallingStore.getState();
      if (activeCall?.callId !== call.callId) return;
      useCallingStore.getState().patchActiveCall({ duration });
    }),
  ];

  void ensureContacts().then(() => refreshCallSnapshot(call));
  return () => subs.forEach((sub) => sub.unsubscribe());
}

export function clearContactsCache() {
  contactsCache = [];
  contactsLoadedAt = 0;
  clearTrackedCalls();
}
