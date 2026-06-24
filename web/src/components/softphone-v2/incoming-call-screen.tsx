'use client';

import {
  callerInitials,
  formatHistoryTimestamp,
  formatPhoneDisplay,
} from '@/components/softphone-v2/utils';
import { PhoneAcceptIcon, PhoneDownIcon } from '@/components/softphone-v2/icons';

type IncomingCallScreenProps = {
  callerName: string;
  callerNumber: string;
  receivedAt: string;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingCallScreen({
  callerName,
  callerNumber,
  receivedAt,
  onAccept,
  onDecline,
}: IncomingCallScreenProps) {
  const formattedNumber = callerNumber || formatPhoneDisplay('');
  const receivedLabel = receivedAt
    ? formatHistoryTimestamp(receivedAt)
    : 'Just now';

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-[#1C1C1E] text-white">
      <div className="flex flex-1 flex-col items-center justify-between px-6 pb-12 pt-20">
        <div className="w-full text-center">
          <p className="text-sm font-medium text-white/45">Incoming call</p>
          <h1 className="mt-4 text-4xl font-light tracking-tight">{callerName || 'Unknown Caller'}</h1>
          <p className="mt-2 text-lg text-white/65">{formattedNumber}</p>
          <p className="mt-1 text-sm text-white/40">{receivedLabel}</p>
        </div>

        <div className="relative my-8 flex items-center justify-center">
          <span className="absolute h-40 w-40 animate-ping rounded-full border border-[#34C759]/30" />
          <span className="absolute h-48 w-48 animate-ping rounded-full border border-[#34C759]/20 [animation-delay:450ms]" />
          <div className="relative flex h-40 w-40 animate-pulse items-center justify-center rounded-full bg-white/10 text-5xl font-light backdrop-blur-md">
            {callerInitials(callerName || callerNumber)}
          </div>
        </div>

        <p className="animate-pulse text-lg font-medium text-[#34C759]">Ringing…</p>

        <div className="flex w-full max-w-sm items-center justify-between gap-8 pt-8">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onDecline}
              className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-[0_12px_40px_rgba(255,59,48,0.45)] transition-transform active:scale-95"
              aria-label="Decline"
            >
              <PhoneDownIcon />
            </button>
            <span className="text-sm font-medium text-[#FF3B30]">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onAccept}
              className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-[#34C759] text-white shadow-[0_12px_40px_rgba(52,199,89,0.45)] transition-transform active:scale-95"
              aria-label="Accept"
            >
              <PhoneAcceptIcon />
            </button>
            <span className="text-sm font-medium text-[#34C759]">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MissedCallToast({
  number,
  onDismiss,
}: {
  number: string;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed left-4 right-4 top-4 z-[70] mx-auto max-w-md">
      <div className="flex items-start justify-between gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-xl backdrop-blur-md">
        <div>
          <p className="text-sm font-semibold text-[#1D1D1F]">Missed Call</p>
          <p className="mt-1 text-sm text-[#8E8E93]">{formatPhoneDisplay(number)}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-2 py-1 text-xs font-medium text-[#007AFF]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
