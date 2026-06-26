import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AttachmentsScreen } from '../screens/messages/AttachmentsScreen';
import { ConversationListScreen } from '../screens/messages/ConversationListScreen';
import { ConversationThreadScreen } from '../screens/messages/ConversationThreadScreen';
import { NewMessageScreen } from '../screens/messages/NewMessageScreen';
import { useTheme } from '../shared/theme';
import type { MessagesStackParamList } from './types';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ title: 'Messages' }}
      />
      <Stack.Screen name="ConversationThread" component={ConversationThreadScreen} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ title: 'New message' }} />
      <Stack.Screen name="Attachments" component={AttachmentsScreen} options={{ title: 'Attachments' }} />
    </Stack.Navigator>
  );
}
