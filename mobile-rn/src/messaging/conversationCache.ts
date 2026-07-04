import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlatformConversation } from './types';

const CACHE_KEY = 'vsp.messaging.conversations.cache';

export async function saveConversationsCache(conversations: PlatformConversation[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), conversations }),
    );
  } catch {
    // Non-fatal offline cache.
  }
}

export async function loadConversationsCache(): Promise<PlatformConversation[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { conversations?: PlatformConversation[] };
    return parsed.conversations ?? [];
  } catch {
    return [];
  }
}
