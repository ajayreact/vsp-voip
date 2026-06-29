import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sendPlatformMessage } from './messagingService';
import { useMessagePreferencesStore } from './messagePreferencesStore';
import type { PlatformMessage } from './types';
import type { MessagesStackParamList } from '../navigation/types';
import { formatPhoneDisplay } from './format';

type MessageActionContext = {
  message: PlatformMessage;
  peerNumber: string;
  lineNumber: string;
  navigation: NativeStackNavigationProp<MessagesStackParamList>;
  onRetryOptimistic?: () => void;
};

export async function copyMessageBody(body: string) {
  await Clipboard.setStringAsync(body);
}

export function showMessageActions({
  message,
  peerNumber,
  lineNumber,
  navigation,
  onRetryOptimistic,
}: MessageActionContext) {
  const isOutbound = String(message.direction).toUpperCase() === 'OUTBOUND';
  const failed = ['failed', 'delivery_failed', 'sending_failed'].includes(
    String(message.status || '').toLowerCase(),
  );

  const options: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
    {
      text: 'Copy',
      onPress: () => {
        void copyMessageBody(message.body || '');
      },
    },
  ];

  if (isOutbound && message.body) {
    options.push({
      text: 'Forward',
      onPress: () => {
        navigation.navigate('NewMessage', {
          peerNumber: '',
          draft: message.body,
        });
      },
    });
  }

  if (failed && isOutbound) {
    options.push({
      text: 'Retry send',
      onPress: () => {
        onRetryOptimistic?.();
        void sendPlatformMessage({
          from: message.from || lineNumber,
          to: message.to || peerNumber,
          text: message.body || '',
        }).catch(() => {
          Alert.alert('Send failed', 'Could not resend this message. Try again from the composer.');
        });
      },
    });
  }

  options.push({
    text: 'Delete',
    style: 'destructive',
    onPress: () => {
      useMessagePreferencesStore.getState().hideMessage(message.id);
    },
  });

  options.push({ text: 'Cancel', style: 'cancel' });

  Alert.alert(
    formatPhoneDisplay(isOutbound ? message.to : message.from),
    message.body?.slice(0, 120) || 'Message actions',
    options,
  );
}
