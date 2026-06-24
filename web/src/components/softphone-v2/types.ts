/** Granular call history status aligned with Telnyx termination + callType taxonomy. */
export type CallHistoryStatus =
  | 'completed'
  | 'missed'
  | 'outbound_no_answer'
  | 'busy'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export type CallHistoryRecord = {
  id: string;
  number: string;
  phoneNumber?: string;
  remotePartyNumber?: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  status: CallHistoryStatus;
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
