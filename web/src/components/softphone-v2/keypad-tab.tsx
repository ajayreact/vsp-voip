'use client';

import { useEffect, useRef } from 'react';
import { KEYPAD_DIGITS, KEYPAD_LETTERS, formatPhoneDisplay } from '@/components/softphone-v2/utils';
import { PhoneAcceptIcon } from '@/components/softphone-v2/icons';
import { cn } from '@/lib/utils';

type KeypadTabProps = {
  destination: string;
  callerNumber: string;
  tenantNumbers: { id: string; number: string }[];
  canPlaceCall: boolean;
  displayStatus: string;
  onDestinationChange: (value: string) => void;
  onAppendDigit: (digit: string) => void;
  onBackspace: () => void;
  onCallerIdChange: (value: string) => void;
  onCall: () => void;
};

export function KeypadTab({
  destination,
  callerNumber,
  tenantNumbers,
  canPlaceCall,
  displayStatus,
  onDestinationChange,
  onAppendDigit,
  onBackspace,
  onCallerIdChange,
  onCall,
}: KeypadTabProps) {
  const statusLabel = displayStatus.includes('DevTools') ? 'Ready' : displayStatus;
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressClearedRef = useRef(false);

  useEffect(() => cancelClearTimer, []);

  function cancelClearTimer() {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }

  function startClearTimer() {
    cancelClearTimer();
    longPressClearedRef.current = false;
    clearTimerRef.current = setTimeout(() => {
      longPressClearedRef.current = true;
      onDestinationChange('');
      clearTimerRef.current = null;
    }, 500);
  }

  function handleBackspaceClick() {
    if (longPressClearedRef.current) {
      longPressClearedRef.current = false;
      return;
    }
    onBackspace();
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-[32px] [--keypad-action-size:clamp(3.75rem,7.4dvh,4.25rem)] [--keypad-gap-x:clamp(0.875rem,3.8vw,1.5rem)] [--keypad-gap-y:clamp(0.25rem,0.9dvh,0.75rem)] [--keypad-size:clamp(2.75rem,6.8dvh,3.85rem)] sm:pt-[40px]">
      <header className="shrink-0 text-center">
        <h1 className="text-[32px] font-bold tracking-tight text-[#1D1D1F]">Keypad</h1>
        <p className="mt-1 text-sm text-[#8E8E93]">{statusLabel}</p>
      </header>

      <div className="mt-3 min-h-[clamp(2.25rem,5dvh,3.5rem)] shrink-0 text-center sm:mt-4">
        <input
          type="tel"
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          inputMode="tel"
          aria-label="Entered phone number"
          className="w-full bg-transparent text-center text-[clamp(1.5rem,4.5dvh,2rem)] font-light leading-tight tracking-wide text-[#1D1D1F] outline-none placeholder:text-[#C7C7CC]"
        />
      </div>

      {tenantNumbers.length > 0 ? (
        <div className="mx-auto mt-1 w-full max-w-xs shrink-0">
          <label htmlFor="softphone-v2-caller-id" className="sr-only">Outbound caller ID</label>
          <select
            id="softphone-v2-caller-id"
            value={callerNumber}
            onChange={(e) => onCallerIdChange(e.target.value)}
            className="w-full rounded-2xl border border-black/5 bg-white px-4 py-2 text-sm text-[#1D1D1F] shadow-sm outline-none"
          >
            {tenantNumbers.map((entry) => (
              <option key={entry.id} value={entry.number}>
                {formatPhoneDisplay(entry.number)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <div className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-x-[var(--keypad-gap-x)] gap-y-[var(--keypad-gap-y)]">
          {KEYPAD_DIGITS.flat().map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => onAppendDigit(digit)}
              className="mx-auto flex h-[var(--keypad-size)] w-[var(--keypad-size)] flex-col items-center justify-center rounded-full bg-white text-[#1D1D1F] shadow-[0_2px_12px_rgba(0,0,0,0.08)] transition-transform hover:scale-[1.03] active:scale-95"
            >
              <span className="text-[clamp(1.375rem,3.6dvh,1.75rem)] font-light leading-none">{digit}</span>
              {KEYPAD_LETTERS[digit] ? (
                <span className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-[#8E8E93]">
                  {KEYPAD_LETTERS[digit]}
                </span>
              ) : (
                <span className="mt-3" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="absolute bottom-2 left-4 right-4 grid grid-cols-3 items-center gap-x-[var(--keypad-gap-x)] bg-[#F5F5F7]/95 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-sm">
        <div className="mx-auto w-[var(--keypad-action-size)]" />
        <button
          type="button"
          disabled={!canPlaceCall}
          onClick={() => {
            console.log('DialPad Call button clicked', { canPlaceCall, destination });
            onCall();
          }}
          className={cn(
            'mx-auto flex h-[var(--keypad-action-size)] w-[var(--keypad-action-size)] items-center justify-center rounded-full bg-[#34C759] text-white shadow-[0_8px_24px_rgba(52,199,89,0.45)] transition-transform hover:scale-105 active:scale-95',
            !canPlaceCall && 'cursor-not-allowed opacity-60 hover:scale-100',
          )}
          aria-label="Call"
        >
          <PhoneAcceptIcon />
        </button>
        <button
          type="button"
          onClick={handleBackspaceClick}
          onPointerDown={destination ? startClearTimer : undefined}
          onPointerUp={cancelClearTimer}
          onPointerCancel={cancelClearTimer}
          onPointerLeave={cancelClearTimer}
          disabled={!destination}
          className="mx-auto flex h-[var(--keypad-action-size)] w-[var(--keypad-action-size)] items-center justify-center rounded-full text-[#8E8E93] transition-transform active:scale-95 disabled:opacity-30"
          aria-label="Delete"
          title="Delete. Press and hold to clear."
        >
          <span className="text-3xl font-light leading-none">⌫</span>
        </button>
      </div>
    </div>
  );
}
