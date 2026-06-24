'use client';

import { BottomTabBar } from '@/components/softphone-v2/bottom-tab-bar';
import { ContactsTab } from '@/components/softphone-v2/contacts-tab';
import { KeypadTab } from '@/components/softphone-v2/keypad-tab';
import { MoreTab } from '@/components/softphone-v2/more-tab';
import {
  ActiveCallScreen,
  OutgoingCallScreen,
} from '@/components/softphone-v2/active-call-screen';
import {
  IncomingCallScreen,
  MissedCallToast,
} from '@/components/softphone-v2/incoming-call-screen';
import { RecentsDetailSheet, RecentsTab } from '@/components/softphone-v2/recents-tab';
import { resolveCallerIdentity } from '@/components/softphone-v2/utils';
import type {
  CallHistoryRecord,
  ContactEntry,
  PhoneTab,
  RecentsFilter,
} from '@/components/softphone-v2/types';
import { VoicemailTab } from '@/components/softphone-v2/voicemail-tab';
import type { SoftphoneTelemetrySnapshot } from '@/lib/softphone-telemetry';
import type { SoftphonePresenceStatus } from '@/lib/softphone-presence';

type IphonePhoneAppProps = {
  remoteAudioId: string;
  activeTab: PhoneTab;
  onTabChange: (tab: PhoneTab) => void;
  voicemailBadge: number;
  onVoicemailUnreadChange: (count: number) => void;
  displayStatus: string;
  showIncomingOverlay: boolean;
  hasLiveCall: boolean;
  isCallActive: boolean;
  callState: string;
  callDirection: 'inbound' | 'outbound' | '';
  displayNumber: string;
  incomingReceivedAt: string;
  callSeconds: number;
  muted: boolean;
  speakerOn: boolean;
  onHold: boolean;
  showInCallKeypad: boolean;
  lastDtmf: string;
  destination: string;
  callerNumber: string;
  tenantNumbers: { id: string; number: string }[];
  canPlaceCall: boolean;
  callHistory: CallHistoryRecord[];
  recentsSearch: string;
  recentsFilter: RecentsFilter;
  contacts: ContactEntry[];
  contactsLoading: boolean;
  contactsSearch: string;
  selectedRecent: CallHistoryRecord | null;
  missedCallToast: { number: string } | null;
  telnyxSocketConnected: boolean;
  telnyxRegistered: boolean;
  reconnecting: boolean;
  presenceStatus: SoftphonePresenceStatus;
  extensionNumber: string | null;
  lastReconnectTime: string | null;
  activeCallCount: number;
  failedCallCount: number;
  missedCallCount: number;
  reconnectCount: number;
  lastTelemetryEvent: SoftphoneTelemetrySnapshot | null;
  onRecentsSearchChange: (value: string) => void;
  onRecentsFilterChange: (filter: RecentsFilter) => void;
  onRecentsSelect: (record: CallHistoryRecord) => void;
  onRecentsInfo: (record: CallHistoryRecord) => void;
  onRecentsCallBack: (record: CallHistoryRecord) => void;
  onCloseRecentDetail: () => void;
  onContactsSearchChange: (value: string) => void;
  onContactSelect: (contact: ContactEntry) => void;
  onDestinationChange: (value: string) => void;
  onAppendDigit: (digit: string) => void;
  onBackspace: () => void;
  onCallerIdChange: (value: string) => void;
  onCall: () => void;
  onAnswer: () => void;
  onDeclineIncoming: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleHold: () => void;
  onToggleInCallKeypad: () => void;
  onDtmf: (digit: string) => void;
  onDismissMissedToast: () => void;
};

export function IphonePhoneApp(props: IphonePhoneAppProps) {
  const {
    remoteAudioId,
    activeTab,
    onTabChange,
    voicemailBadge,
    onVoicemailUnreadChange,
    displayStatus,
    showIncomingOverlay,
    hasLiveCall,
    isCallActive,
    callState,
    callDirection,
    displayNumber,
    incomingReceivedAt,
    callSeconds,
    muted,
    speakerOn,
    onHold,
    showInCallKeypad,
    lastDtmf,
    destination,
    callerNumber,
    tenantNumbers,
    canPlaceCall,
    callHistory,
    recentsSearch,
    recentsFilter,
    contacts,
    contactsLoading,
    contactsSearch,
    selectedRecent,
    missedCallToast,
    telnyxSocketConnected,
    telnyxRegistered,
    reconnecting,
    presenceStatus,
    extensionNumber,
    lastReconnectTime,
    activeCallCount,
    failedCallCount,
    missedCallCount,
    reconnectCount,
    lastTelemetryEvent,
    onRecentsSearchChange,
    onRecentsFilterChange,
    onRecentsSelect,
    onRecentsInfo,
    onRecentsCallBack,
    onCloseRecentDetail,
    onContactsSearchChange,
    onContactSelect,
    onDestinationChange,
    onAppendDigit,
    onBackspace,
    onCallerIdChange,
    onCall,
    onAnswer,
    onDeclineIncoming,
    onHangup,
    onToggleMute,
    onToggleSpeaker,
    onToggleHold,
    onToggleInCallKeypad,
    onDtmf,
    onDismissMissedToast,
  } = props;

  const showOutgoingOverlay = hasLiveCall
    && callDirection === 'outbound'
    && !isCallActive
    && callState !== 'held';

  const showActiveOverlay = hasLiveCall && (isCallActive || callState === 'held');
  const liveIdentity = resolveCallerIdentity(displayNumber, contacts);

  return (
    <div className="fixed inset-0 z-0 flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#E9E9EE] text-[#1D1D1F] sm:p-4 lg:bg-[radial-gradient(circle_at_top,#ffffff_0%,#E5E5EA_45%,#D1D1D6_100%)]">
      <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F5F5F7] shadow-2xl sm:h-[min(860px,calc(100dvh-2rem))] sm:max-w-[430px] sm:rounded-[3rem] sm:border-[10px] sm:border-[#111]">
        <div className="pointer-events-none absolute left-1/2 top-2 z-[80] hidden h-6 w-32 -translate-x-1/2 rounded-full bg-black sm:block" />
      {showIncomingOverlay ? (
        <IncomingCallScreen
          callerName={liveIdentity.name}
          callerNumber={liveIdentity.number}
          receivedAt={incomingReceivedAt}
          onAccept={onAnswer}
          onDecline={onDeclineIncoming}
        />
      ) : null}

      {showOutgoingOverlay ? (
        <OutgoingCallScreen
          callerName={liveIdentity.name}
          callerNumber={liveIdentity.number}
          callState={callState}
          onHangup={onHangup}
        />
      ) : null}

      {showActiveOverlay ? (
        <ActiveCallScreen
          callerName={liveIdentity.name}
          callerNumber={liveIdentity.number}
          callState={callState}
          onHold={onHold}
          callSeconds={callSeconds}
          muted={muted}
          speakerOn={speakerOn}
          showKeypad={showInCallKeypad}
          lastDtmf={lastDtmf}
          onToggleMute={onToggleMute}
          onToggleSpeaker={onToggleSpeaker}
          onToggleHold={onToggleHold}
          onToggleKeypad={onToggleInCallKeypad}
          onDtmf={onDtmf}
          onHangup={onHangup}
        />
      ) : null}

      {missedCallToast ? (
        <MissedCallToast number={missedCallToast.number} onDismiss={onDismissMissedToast} />
      ) : null}

      {!hasLiveCall ? (
        <>
          <main className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {activeTab === 'recents' ? (
              <RecentsTab
                records={callHistory}
                search={recentsSearch}
                filter={recentsFilter}
                contacts={contacts}
                onSearchChange={onRecentsSearchChange}
                onFilterChange={onRecentsFilterChange}
                onSelect={onRecentsSelect}
                onInfo={onRecentsInfo}
                onCallBack={onRecentsCallBack}
              />
            ) : null}
            {activeTab === 'contacts' ? (
              <ContactsTab
                contacts={contacts}
                loading={contactsLoading}
                search={contactsSearch}
                onSearchChange={onContactsSearchChange}
                onSelect={onContactSelect}
              />
            ) : null}
            {activeTab === 'keypad' ? (
              <KeypadTab
                destination={destination}
                callerNumber={callerNumber}
                tenantNumbers={tenantNumbers}
                canPlaceCall={canPlaceCall}
                displayStatus={displayStatus}
                onDestinationChange={onDestinationChange}
                onAppendDigit={onAppendDigit}
                onBackspace={onBackspace}
                onCallerIdChange={onCallerIdChange}
                onCall={onCall}
              />
            ) : null}
            {activeTab === 'voicemail' ? (
              <VoicemailTab onUnreadCountChange={onVoicemailUnreadChange} />
            ) : null}
            {activeTab === 'more' ? (
              <MoreTab
                telnyxSocketConnected={telnyxSocketConnected}
                telnyxRegistered={telnyxRegistered}
                reconnecting={reconnecting}
                presenceStatus={presenceStatus}
                callerId={callerNumber}
                activeCallCount={activeCallCount}
                failedCallCount={failedCallCount}
                missedCallCount={missedCallCount}
                reconnectCount={reconnectCount}
                lastTelemetryEvent={lastTelemetryEvent}
                displayStatus={displayStatus}
              />
            ) : null}
          </main>
          <BottomTabBar
            activeTab={activeTab}
            onTabChange={onTabChange}
            voicemailBadge={voicemailBadge}
          />
        </>
      ) : null}

      <RecentsDetailSheet
        record={selectedRecent}
        onClose={onCloseRecentDetail}
        onCallBack={(record) => {
          onCloseRecentDetail();
          onRecentsCallBack(record);
        }}
      />

      <audio
        id={remoteAudioId}
        autoPlay
        playsInline
        className="sr-only"
        aria-hidden
      />
      </div>
    </div>
  );
}
