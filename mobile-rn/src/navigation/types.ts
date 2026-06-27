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
  RecentMain: undefined;
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
  NewMessage: { peerNumber?: string; peerLabel?: string } | undefined;
  Attachments: { conversationId?: string };
  MessageSearch: undefined;
};

export type ContactsStackParamList = {
  ContactsList: undefined;
  ContactDetail: { contactId: string };
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
};

export type MainTabParamList = {
  Recent: NavigatorScreenParams<RecentStackParamList>;
  Contacts: NavigatorScreenParams<ContactsStackParamList>;
  Keypad: undefined;
  Text: NavigatorScreenParams<MessagesStackParamList>;
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
