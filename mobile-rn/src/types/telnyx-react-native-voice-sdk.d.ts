declare module '@telnyx/react-native-voice-sdk' {
  export class Call {
    id: string;
    state: string;
    direction: string;
    remoteCallerNumber?: string;
    remotePartyNumber?: string;
    remotePartyName?: string;
    localPartyNumber?: string;
  }

  export class TelnyxRTC {
    constructor(options?: Record<string, unknown>);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    newCall(options: Record<string, unknown>): Call;
  }
}
