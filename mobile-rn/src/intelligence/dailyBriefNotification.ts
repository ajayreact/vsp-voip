import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { VSP_AI_BRANDING } from '../ai/vspAiBranding';
import { dailyBriefNotificationBody } from './dailyBrief';
import type { DailyBrief } from './types';

const STORAGE_KEY = 'vsp.dailyBriefNotificationDate';

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function maybeScheduleDailyBriefNotification(brief: DailyBrief): Promise<void> {
  const now = new Date();
  const hour = now.getHours();
  if (hour < 6 || hour > 11) return;

  const key = todayKey(now);
  const last = await AsyncStorage.getItem(STORAGE_KEY);
  if (last === key) return;

  const greeting = hour < 12 ? 'Good Morning' : 'Good Afternoon';
  const body = dailyBriefNotificationBody(brief);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${greeting}\n${VSP_AI_BRANDING.poweredBy}\n${VSP_AI_BRANDING.dailyBrief}`,
      body,
      data: { kind: 'daily_brief' },
      ...(Platform.OS === 'android' ? { channelId: 'vsp_system' } : {}),
    },
    trigger: null,
  });

  await AsyncStorage.setItem(STORAGE_KEY, key);
}

export async function resetDailyBriefNotificationForTests(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
