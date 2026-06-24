export type CallHistoryRecord = {
  id: string;
  number: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  status: 'completed' | 'missed' | 'rejected';
  timestamp: string;
};

export type PhoneTab = 'voicemail' | 'recents' | 'contacts' | 'keypad' | 'more';

export type RecentsFilter = 'all' | 'missed';

export type ContactEntry = {
  id: string;
  name: string;
  extensionNumber: string;
  department: string;
  number?: string | null;
};
