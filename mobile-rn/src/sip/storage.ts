import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SipProfile } from './types';
import { createTelnyxDefaultProfile, DEFAULT_CODECS } from './defaults';

const STORAGE_KEY = '@vsp/sip-profile/v1';

function reviveCodecs(raw: unknown): SipProfile['codecs'] {
  if (!Array.isArray(raw)) return DEFAULT_CODECS.map((c) => ({ ...c }));
  const known = new Map(DEFAULT_CODECS.map((c) => [c.id, c]));
  const merged = raw
    .filter((entry): entry is SipProfile['codecs'][number] => Boolean(entry && typeof entry === 'object'))
    .map((entry) => {
      const base = known.get(entry.id as SipProfile['codecs'][number]['id']);
      if (!base) return null;
      return { ...base, enabled: Boolean(entry.enabled) };
    })
    .filter(Boolean) as SipProfile['codecs'];

  const present = new Set(merged.map((c) => c.id));
  for (const codec of DEFAULT_CODECS) {
    if (!present.has(codec.id)) merged.push({ ...codec });
  }
  return merged;
}

export async function loadStoredSipProfile(): Promise<SipProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SipProfile>;
    return {
      ...createTelnyxDefaultProfile(),
      ...parsed,
      codecs: reviveCodecs(parsed.codecs),
    };
  } catch {
    return null;
  }
}

export async function saveStoredSipProfile(profile: SipProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export async function clearStoredSipProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
