import type { NavigatorScreenParams } from '@react-navigation/native';
import type { CallLogEntry } from '../api/types';

export type AuthStackParamList = {
  Login: undefined;
  QrLogin: undefined;
};

export type HomeStackParamList = {
  HomeMain: undefined;
  CallDetails: { callId: string; call?: CallLogEntry };
  NotificationsCenter: undefined;
};

export type RecentStackParamList = {
  RecentMain: { initialFilter?: string } | undefined;
  CallDetails: { callId: string; call?: CallLogEntry };
};

/** @deprecated Use RecentStackParamList */
export type CallsStackParamList = RecentStackParamList & {
  CallsHub?: undefined;
  VoicemailList?: undefined;
  VoicemailDetail?: { voicemailId: string };
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  ConversationThread: {
    conversationId: string;
    peerLabel: string;
    lineLabel?: string;
    peerNumber?: string;
  };
  NewMessage: { peerNumber?: string; peerLabel?: string; draft?: string } | undefined;
  Attachments: { conversationId?: string };
  MessageSearch: undefined;
};

export type ContactsStackParamList = {
  ContactsList: undefined;
  ContactDetail: { contactId: string; kind?: 'company' | 'customer' };
  CustomerContactDetail: { customerId: string };
  CustomerContactForm: { customerId?: string };
};

export type YouStackParamList = {
  YouHome: undefined;
  Profile: undefined;
  Organization: undefined;
  Extensions: undefined;
  Numbers: undefined;
  SipConfiguration: undefined;
  Theme: undefined;
  Notifications: undefined;
  About: undefined;
  VoicemailList: undefined;
  VoicemailDetail: { voicemailId: string };
  SettingsDevices: undefined;
  SettingsDeviceInfo: undefined;
  SettingsCalling: undefined;
  SettingsVoicemail: undefined;
  SettingsMessaging: undefined;
  SettingsSecurity: undefined;
  SettingsDiagnostics: undefined;
  SettingsSupport: undefined;
  SettingsChangePassword: undefined;
  QrProvision: undefined;
};

export type AiStackParamList = {
  AssistantHome: { initialQuestion?: string } | undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Recent: NavigatorScreenParams<RecentStackParamList>;
  Contacts: NavigatorScreenParams<ContactsStackParamList>;
  Keypad: undefined;
  Text: NavigatorScreenParams<MessagesStackParamList>;
  AI: NavigatorScreenParams<AiStackParamList>;
  You: NavigatorScreenParams<YouStackParamList>;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  SessionExpired: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
