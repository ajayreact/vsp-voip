import { create } from 'zustand';
import type { Call } from '@telnyx/react-voice-commons-sdk';
import { TelnyxCallState, TelnyxConnectionState } from '@telnyx/react-voice-commons-sdk';

export type CallUiIdentity = {
  name: string;
  number: string;
  initials?: string;
};

export type CallSessionSnapshot = {
  call: Call;
  callId: string;
  state: TelnyxCallState;
  isMuted: boolean;
  isHeld: boolean;
  duration: number;
  isIncoming: boolean;
  identity: CallUiIdentity;
  showKeypad: boolean;
  lastDtmf: string;
  speakerOn: boolean;
};

type CallingState = {
  connectionState: TelnyxConnectionState;
  registrationError: string | null;
  isRegistering: boolean;
  registrationAttempt: number;
  tenantNumbers: string[];
  defaultCallerId: string;
  incomingCall: CallSessionSnapshot | null;
  activeCall: CallSessionSnapshot | null;
  setConnectionState: (state: TelnyxConnectionState) => void;
  setRegistrationError: (message: string | null) => void;
  setIsRegistering: (value: boolean) => void;
  setTenantNumbers: (numbers: string[], defaultCallerId: string) => void;
  setIncomingCall: (snapshot: CallSessionSnapshot | null) => void;
  setActiveCall: (snapshot: CallSessionSnapshot | null) => void;
  patchActiveCall: (patch: Partial<CallSessionSnapshot>) => void;
  patchIncomingCall: (patch: Partial<CallSessionSnapshot>) => void;
  resetCalls: () => void;
  retryRegistration: () => void;
};

export const useCallingStore = create<CallingState>((set) => ({
  connectionState: TelnyxConnectionState.DISCONNECTED,
  registrationError: null,
  isRegistering: false,
  registrationAttempt: 0,
  tenantNumbers: [],
  defaultCallerId: '',
  incomingCall: null,
  activeCall: null,

  setConnectionState: (connectionState) => set({ connectionState }),
  setRegistrationError: (registrationError) => set({ registrationError }),
  setIsRegistering: (isRegistering) => set({ isRegistering }),
  setTenantNumbers: (tenantNumbers, defaultCallerId) => set({ tenantNumbers, defaultCallerId }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  setActiveCall: (activeCall) => set({ activeCall }),
  patchActiveCall: (patch) => set((state) => ({
    activeCall: state.activeCall ? { ...state.activeCall, ...patch } : state.activeCall,
  })),
  patchIncomingCall: (patch) => set((state) => ({
    incomingCall: state.incomingCall ? { ...state.incomingCall, ...patch } : state.incomingCall,
  })),
  resetCalls: () => set({ incomingCall: null, activeCall: null }),
  retryRegistration: () => set((state) => ({
    registrationAttempt: state.registrationAttempt + 1,
    registrationError: null,
  })),
}));
