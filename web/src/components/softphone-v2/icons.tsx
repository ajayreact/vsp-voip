export function PhoneDownIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} rotate-[135deg]`} fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24c1.12.37 2.33.57 3.59.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.2 2.47.57 3.59a1 1 0 0 1-.25 1.01l-2.2 2.19Z" />
    </svg>
  );
}

export function PhoneAcceptIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1-.24c1.12.37 2.33.57 3.59.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.26.2 2.47.57 3.59a1 1 0 0 1-.25 1.01l-2.2 2.19Z" />
    </svg>
  );
}

export function MicIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
    </svg>
  );
}

export function MicOffIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M16.5 12A4.5 4.5 0 0 0 12 7.5v2.03l4.47 4.47ZM19 11h-1.05A6.98 6.98 0 0 0 13 5.08V3h-2v2.08A6.98 6.98 0 0 0 6.05 11H5v2h1.05A6.98 6.98 0 0 0 11 18.92V21h2v-2.08A6.98 6.98 0 0 0 17.95 13H19v-2Z" />
    </svg>
  );
}

export function SpeakerIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5Zm2.17 3.41A7 7 0 0 1 18 12a7 7 0 0 1-4.83 3.59l1.06 1.77A8.96 8.96 0 0 0 20 12a8.96 8.96 0 0 0-5.77-5.36l1.06 1.77Z" />
    </svg>
  );
}

export function HoldIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" />
    </svg>
  );
}
