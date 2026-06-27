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
