export type AuthStackParamList = {
  Login: undefined;
};

export type DashboardStackParamList = {
  DashboardHome: undefined;
};

export type CallsStackParamList = {
  CallsHub: undefined;
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  ConversationThread: {
    conversationId: string;
    peerLabel: string;
    lineLabel?: string;
  };
  NewMessage: undefined;
  Attachments: { conversationId?: string };
  MessageSearch: undefined;
};

export type ContactsStackParamList = {
  ContactsList: undefined;
  ContactDetail: { contactId: string };
};

export type VoicemailStackParamList = {
  VoicemailList: undefined;
  VoicemailDetail: { voicemailId: string };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  Theme: undefined;
  Notifications: undefined;
  About: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Calls: undefined;
  Messages: undefined;
  Contacts: undefined;
  Voicemail: undefined;
  Settings: undefined;
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
