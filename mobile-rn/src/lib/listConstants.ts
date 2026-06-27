/** Approximate row heights for FlashList drawDistance tuning (v2 auto-sizes; used for overrides). */
export const LIST_ITEM_HEIGHT = {
  call: 64,
  contact: 68,
  conversation: 76,
  voicemail: 72,
  message: 120,
  separator: 36,
} as const;

export function keyExtractorById<T extends { id: string }>(item: T): string {
  return item.id;
}
