/** Centralized background sync intervals — tune here for battery vs freshness. */
export const SYNC_PROFILES = {
  messaging: { foregroundMs: 15_000, backgroundMs: 90_000 },
  messagingOutbox: { foregroundMs: 20_000, backgroundMs: 120_000 },
  voicemail: { foregroundMs: 30_000, backgroundMs: 120_000 },
  contactsPresenceMs: 60_000,
  assistantSuggestionsStaleMs: 5 * 60_000,
} as const;
