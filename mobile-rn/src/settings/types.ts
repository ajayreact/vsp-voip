export type SoftphoneDevice = {
  deviceId: string;
  platform: string;
  deviceName: string | null;
  appVersion: string | null;
  lastSeenAt: string;
  pushTokenPreview?: string;
};

export type SoftphoneDiagnostics = {
  success?: boolean;
  outboundReady?: boolean;
  credentialConnection?: {
    id?: string | null;
    name?: string | null;
    webhookUrl?: string | null;
    outboundVoiceProfileId?: string | null;
  };
  callControlApplication?: {
    id?: string | null;
    name?: string | null;
    webhookConfigured?: boolean;
    webhookUrl?: string | null;
    webhooksReachable?: boolean;
  };
  inboundRouting?: {
    ready?: boolean;
    message?: string | null;
    sipUsername?: string | null;
  };
  push?: {
    telnyxPortal?: Record<string, unknown>;
    userDevices?: {
      registered?: boolean;
      count?: number;
      devices?: SoftphoneDevice[];
    };
    note?: string;
  };
  fix?: string | null;
};

export type VoicemailPlaybackSpeed = '0.75' | '1' | '1.25' | '1.5';
export type FontSizePreference = 'default' | 'large' | 'extraLarge';
export type LanguagePreference = 'en';

export type ClientSettingsPrefs = {
  voicemailPlaybackSpeed: VoicemailPlaybackSpeed;
  voicemailAutoDownload: boolean;
  messagingDeliveryReports: boolean;
  messagingSignature: string;
  systemAlerts: boolean;
  fontSize: FontSizePreference;
  language: LanguagePreference;
};

export type LiveSettingsStatus = {
  sipRegistration: string;
  pushRegistration: string;
  audioRoute: string;
  network: string;
  appVersion: string;
  buildNumber: string;
  apiEnvironment: string;
};
