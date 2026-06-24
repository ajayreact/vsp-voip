'use client';

import type { ReactNode } from 'react';
import {
  Grid3X3,
  Mic,
  MicOff,
  Phone,
  UserPlus,
  Volume2,
} from 'lucide-react';
import {
  HoldIcon,
  PhoneDownIcon,
} from '@/components/softphone-v2/icons';
import {
  callStatusLabel,
  formatCallTimer,
  formatPhoneDisplay,
} from '@/components/softphone-v2/utils';
import { cn } from '@/lib/utils';

type ActiveCallScreenProps = {
  callerName: string;
  callerNumber: string;
  callState: string;
  onHold: boolean;
  callSeconds: number;
  muted: boolean;
  speakerOn: boolean;
  showKeypad: boolean;
  lastDtmf: string;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
  onToggleHold: () => void;
  onToggleKeypad: () => void;
  onDtmf: (digit: string) => void;
  onHangup: () => void;
};

function CallAction({
  label,
  icon,
  active,
  disabled,
  badge,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-center gap-2 disabled:opacity-35"
    >
      <span
        className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full transition-colors',
          active ? 'bg-white text-[#1D1D1F]' : 'bg-white/15 text-white',
        )}
      >
        {icon}
      </span>
      <span className="text-xs font-medium text-white/90">
        {label}
        {badge ? <span className="ml-1 text-[10px] text-white/45">{badge}</span> : null}
      </span>
    </button>
  );
}

export function ActiveCallScreen({
  callerName,
  callerNumber,
  callState,
  onHold,
  callSeconds,
  muted,
  speakerOn,
  showKeypad,
  lastDtmf,
  onToggleMute,
  onToggleSpeaker,
  onToggleHold,
  onToggleKeypad,
  onDtmf,
  onHangup,
}: ActiveCallScreenProps) {
  const isActive = callState === 'active' || callState === 'held';
  const keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
  const formattedNumber = formatPhoneDisplay(callerNumber);
  const hasCallerName = Boolean(
    callerName
    && callerName !== callerNumber
    && callerName !== formattedNumber
    && callerName !== 'Unknown Caller',
  );

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#1C1C1E] text-white">
      <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center">
        <h1 className="mt-2 max-w-full truncate text-3xl font-light tracking-tight">
          {hasCallerName ? callerName : formattedNumber}
        </h1>
        {hasCallerName ? (
          <p className="mt-2 max-w-full truncate text-base text-white/55">{formattedNumber}</p>
        ) : null}
        <p className="mt-4 text-base text-white/65">
          {callStatusLabel(onHold ? 'held' : callState)}
        </p>
        {isActive ? (
          <p className="mt-6 font-mono text-4xl tabular-nums text-white/95">
            {formatCallTimer(callSeconds)}
          </p>
        ) : null}

        {showKeypad && isActive ? (
          <div className="mt-8 grid w-full max-w-[280px] grid-cols-3 gap-4">
            {keypadDigits.map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => onDtmf(digit)}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-light transition-transform active:scale-95"
              >
                {digit}
              </button>
            ))}
          </div>
        ) : null}

        {lastDtmf ? (
          <p className="mt-4 text-sm text-white/50">Last key: {lastDtmf}</p>
        ) : null}
      </div>

      <div className="px-6 pb-10">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-x-4 gap-y-6">
          <CallAction
            label="Mute"
            icon={muted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            active={muted}
            disabled={!isActive}
            onClick={onToggleMute}
          />
          <CallAction
            label="Keypad"
            icon={<Grid3X3 className="h-7 w-7" />}
            active={showKeypad}
            disabled={!isActive}
            onClick={onToggleKeypad}
          />
          <CallAction
            label="Speaker"
            icon={<Volume2 className="h-7 w-7" />}
            active={speakerOn}
            disabled={!isActive}
            onClick={onToggleSpeaker}
          />
          <CallAction
            label="Hold"
            icon={<HoldIcon className="h-7 w-7" />}
            active={onHold}
            disabled={!isActive && callState !== 'held'}
            onClick={onToggleHold}
          />
          <CallAction
            label="Add Call"
            icon={<UserPlus className="h-7 w-7 opacity-40" />}
            disabled
            badge="Off"
          />
          <CallAction
            label="Record"
            icon={<Mic className="h-7 w-7 opacity-40" />}
            disabled
            badge="Off"
          />
        </div>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={onHangup}
            className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-[0_12px_40px_rgba(255,59,48,0.45)] transition-transform active:scale-95"
            aria-label="End Call"
          >
            <PhoneDownIcon />
          </button>
        </div>
        <p className="mt-3 text-center text-sm font-medium text-white/70">End Call</p>
      </div>
    </div>
  );
}

export function OutgoingCallScreen({
  callerName,
  callerNumber,
  callState,
  onHangup,
}: {
  callerName: string;
  callerNumber: string;
  callState: string;
  onHangup: () => void;
}) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#1C1C1E] text-white">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-medium text-white/55">Calling</p>
        <h1 className="mt-3 max-w-full truncate text-4xl font-light tracking-tight">{callerName || 'Unknown Caller'}</h1>
        <p className="mt-2 max-w-full truncate text-base text-white/55">{formatPhoneDisplay(callerNumber)}</p>
        <p className="mt-4 animate-pulse text-lg text-[#34C759]">{callStatusLabel(callState)}</p>
      </div>
      <div className="flex justify-center pb-12">
        <button
          type="button"
          onClick={onHangup}
          className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-[#FF3B30] text-white shadow-[0_12px_40px_rgba(255,59,48,0.45)]"
          aria-label="Cancel call"
        >
          <PhoneDownIcon />
        </button>
      </div>
    </div>
  );
}
