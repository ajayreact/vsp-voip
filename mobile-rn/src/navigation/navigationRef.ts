import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToConversation(params: {
  conversationId: string;
  peerLabel: string;
  lineLabel?: string;
  peerNumber?: string;
}) {
  if (!navigationRef.isReady()) return false;

  navigationRef.navigate('Main', {
    screen: 'Text',
    params: {
      screen: 'ConversationThread',
      params,
    },
  } as never);
  return true;
}

export function navigateToVoicemail(voicemailId: string) {
  if (!navigationRef.isReady()) return false;

  navigationRef.navigate('Main', {
    screen: 'You',
    params: {
      screen: 'VoicemailDetail',
      params: { voicemailId },
    },
  } as never);
  return true;
}

export function navigateToRecentCalls(filter?: string) {
  if (!navigationRef.isReady()) return false;

  navigationRef.navigate('Main', {
    screen: 'Recent',
    params: filter
      ? { screen: 'RecentMain', params: { initialFilter: filter } }
      : undefined,
  } as never);
  return true;
}

export function navigateToNotificationsCenter() {
  if (!navigationRef.isReady()) return false;

  navigationRef.navigate('Main', {
    screen: 'Home',
    params: { screen: 'NotificationsCenter' },
  } as never);
  return true;
}
