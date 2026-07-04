import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SipProfile } from './types';
import { createTelnyxDefaultProfile, DEFAULT_CODECS } from './defaults';

const STORAGE_KEY = '@vsp/sip-profile/v1';
const PASSWORD_KEY = 'vsp.sipPassword';

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

async function readStoredPassword(legacyFromProfile?: string): Promise<string> {
  try {
    const secure = await SecureStore.getItemAsync(PASSWORD_KEY);
    if (secure) return secure;
  } catch {
    /* fall through */
  }
  return legacyFromProfile ?? '';
}

async function writeStoredPassword(password: string): Promise<void> {
  try {
    if (password) {
      await SecureStore.setItemAsync(PASSWORD_KEY, password);
    } else {
      await SecureStore.deleteItemAsync(PASSWORD_KEY);
    }
  } catch {
    /* best effort */
  }
}

async function migrateLegacyPassword(profile: Partial<SipProfile>): Promise<void> {
  if (!profile.password) return;
  await writeStoredPassword(profile.password);
  const { password: _removed, ...rest } = profile;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
}

export async function loadStoredSipProfile(): Promise<SipProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SipProfile>;
    if (parsed.password) {
      await migrateLegacyPassword(parsed);
    }
    const password = await readStoredPassword();
    return {
      ...createTelnyxDefaultProfile(),
      ...parsed,
      password,
      codecs: reviveCodecs(parsed.codecs),
    };
  } catch {
    return null;
  }
}

export async function saveStoredSipProfile(profile: SipProfile): Promise<void> {
  const { password, ...rest } = profile;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  await writeStoredPassword(password);
}

export async function clearStoredSipProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  await writeStoredPassword('');
}
