import { create } from 'zustand';
import { VspCallState, VspConnectionState } from '../calling/vspTelephonyState';

/** Opaque Telnyx call handle — only the calling layer touches the native SDK object. */
export type TelnyxCallHandle = object;

export type CallUiIdentity = {
  name: string;
  number: string;
  initials?: string;
  company?: string;
  businessLine?: string;
};

export type CallSessionSnapshot = {
  call: TelnyxCallHandle;
  callId: string;
  state: VspCallState;
  isMuted: boolean;
  isHeld: boolean;
  duration: number;
  isIncoming: boolean;
  identity: CallUiIdentity;
  identityLocked?: boolean;
  showKeypad: boolean;
  lastDtmf: string;
  speakerOn: boolean;
};

type CallingState = {
  connectionState: VspConnectionState;
  registrationError: string | null;
  isRegistering: boolean;
  registrationAttempt: number;
  tenantNumbers: string[];
  defaultCallerId: string;
  incomingCall: CallSessionSnapshot | null;
  activeCall: CallSessionSnapshot | null;
  setConnectionState: (state: VspConnectionState) => void;
  setRegistrationError: (message: string | null) => void;
  setIsRegistering: (value: boolean) => void;
  setTenantNumbers: (numbers: string[], defaultCallerId: string) => void;
  setIncomingCall: (snapshot: CallSessionSnapshot | null) => void;
  setActiveCall: (snapshot: CallSessionSnapshot | null) => void;
  patchActiveCall: (patch: Partial<CallSessionSnapshot>) => void;
  patchIncomingCall: (patch: Partial<CallSessionSnapshot>) => void;
  resetCalls: () => void;
  retryRegistration: () => void;
  pushTokenSyncAttempt: number;
  requestPushTokenSync: () => void;
};

export const useCallingStore = create<CallingState>((set) => ({
  connectionState: VspConnectionState.DISCONNECTED,
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
  pushTokenSyncAttempt: 0,
  requestPushTokenSync: () => set((state) => ({
    pushTokenSyncAttempt: state.pushTokenSyncAttempt + 1,
  })),
}));
