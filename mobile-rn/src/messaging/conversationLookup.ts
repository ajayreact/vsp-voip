import type { PlatformConversation } from './types';
import { normalizePeerNumber } from './format';

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

export function peerNumbersMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db = digitsOnly(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10 && da.slice(-10) === db.slice(-10)) return true;
  return normalizePeerNumber(a) === normalizePeerNumber(b);
}

export function findConversationByPeer(
  conversations: PlatformConversation[],
  peerNumber: string,
): PlatformConversation | undefined {
  const trimmed = peerNumber.trim();
  if (!trimmed) return undefined;
  return conversations.find((conversation) => peerNumbersMatch(conversation.peer, trimmed));
}
