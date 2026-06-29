import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ConversationListScreen } from '../screens/messages/ConversationListScreen';
import { useStackScreenOptions } from '../hooks/useStackScreenOptions';
import type { MessagesStackParamList } from './types';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStackNavigator() {
  const { screenOptions, detailOptions, modalOptions } = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ title: 'Text', headerShown: false }}
      />
      <Stack.Screen
        name="ConversationThread"
        getComponent={() => require('../screens/messages/ConversationThreadScreen').ConversationThreadScreen}
        options={detailOptions}
      />
      <Stack.Screen
        name="NewMessage"
        getComponent={() => require('../screens/messages/NewMessageScreen').NewMessageScreen}
        options={{ title: 'New message', ...modalOptions }}
      />
      <Stack.Screen
        name="MessageSearch"
        getComponent={() => require('../screens/messages/MessageSearchScreen').MessageSearchScreen}
        options={{ title: 'Search', ...modalOptions }}
      />
      <Stack.Screen
        name="Attachments"
        getComponent={() => require('../screens/messages/AttachmentsScreen').AttachmentsScreen}
        options={{ title: 'Attachments', ...detailOptions }}
      />
    </Stack.Navigator>
  );
}
