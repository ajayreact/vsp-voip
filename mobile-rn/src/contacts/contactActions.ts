import { Alert } from 'react-native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { getFriendlyCallError, placeOutboundCall } from '../calling/callingController';
import { findConversationByPeer } from '../messaging/conversationLookup';
import { formatPhoneDisplay } from '../messaging/format';
import type { PlatformConversation } from '../messaging/types';
import type { MainTabParamList } from '../navigation/types';
import { primaryDialNumber, type UnifiedContact } from './types';
import { useCustomerContactsStore } from './customerContactsStore';

export async function callUnifiedContact(
  contact: UnifiedContact,
  canPlaceCalls: boolean,
): Promise<boolean> {
  const dialNumber = primaryDialNumber(contact);
  if (!dialNumber) {
    Alert.alert('No number', 'This contact has no dialable number.');
    return false;
  }
  if (!canPlaceCalls) {
    Alert.alert('Unable to place call', 'The phone is not connected. Please wait while we reconnect.');
    return false;
  }
  try {
    await placeOutboundCall(dialNumber);
    if (contact.kind === 'customer') {
      void useCustomerContactsStore.getState().touchLastContact(contact.id);
    }
    return true;
  } catch (error) {
    Alert.alert('Unable to place call', getFriendlyCallError(error));
    return false;
  }
}

export function messageUnifiedContact(
  contact: UnifiedContact,
  conversations: PlatformConversation[],
  tabNavigation: BottomTabNavigationProp<MainTabParamList> | undefined,
) {
  const peerNumber = primaryDialNumber(contact);
  if (!peerNumber || !tabNavigation) return;

  const existing = findConversationByPeer(conversations, peerNumber);
  if (existing) {
    tabNavigation.navigate('Text', {
      screen: 'ConversationThread',
      params: {
        conversationId: existing.id,
        peerLabel: formatPhoneDisplay(existing.peer),
        lineLabel: existing.line,
        peerNumber: existing.peer,
      },
    });
    return;
  }

  tabNavigation.navigate('Text', {
    screen: 'NewMessage',
    params: {
      peerNumber,
      peerLabel: contact.name,
    },
  });

  if (contact.kind === 'customer') {
    void useCustomerContactsStore.getState().touchLastContact(contact.id);
  }
}

export function openUnifiedContact(
  contact: UnifiedContact,
  navigation: { navigate: (screen: string, params: Record<string, string>) => void },
) {
  if (contact.kind === 'customer' && !contact.id.startsWith('recent-')) {
    navigation.navigate('CustomerContactDetail', { customerId: contact.id });
    return;
  }
  if (contact.kind === 'company' && contact.id && !contact.id.startsWith('recent-')) {
    navigation.navigate('ContactDetail', { contactId: contact.id, kind: 'company' });
  }
}
