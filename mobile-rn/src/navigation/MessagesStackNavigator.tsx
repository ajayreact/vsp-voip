import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { AttachmentsScreen } from '../screens/messages/AttachmentsScreen';
import { ConversationListScreen } from '../screens/messages/ConversationListScreen';
import { ConversationThreadScreen } from '../screens/messages/ConversationThreadScreen';
import { NewMessageScreen } from '../screens/messages/NewMessageScreen';
import { useTheme } from '../shared/theme';
import { createStackScreenOptions, DETAIL_SCREEN_OPTIONS, MODAL_SCREEN_OPTIONS } from './screenOptions';
import type { MessagesStackParamList } from './types';

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStackNavigator() {
  const { colors } = useTheme();
  const screenOptions = useMemo(() => createStackScreenOptions(colors), [colors]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="ConversationList"
        component={ConversationListScreen}
        options={{ title: 'Text', headerShown: false }}
      />
      <Stack.Screen
        name="ConversationThread"
        component={ConversationThreadScreen}
        options={DETAIL_SCREEN_OPTIONS}
      />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ title: 'New message', ...MODAL_SCREEN_OPTIONS }} />
      <Stack.Screen
        name="MessageSearch"
        getComponent={() => require('../screens/messages/MessageSearchScreen').MessageSearchScreen}
        options={{ title: 'Search', ...MODAL_SCREEN_OPTIONS }}
      />
      <Stack.Screen
        name="Attachments"
        getComponent={() => require('../screens/messages/AttachmentsScreen').AttachmentsScreen}
        options={{ title: 'Attachments', ...DETAIL_SCREEN_OPTIONS }}
      />
    </Stack.Navigator>
  );
}
