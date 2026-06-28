import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { ContactDetailScreen } from '../screens/contacts/ContactDetailScreen';
import { ContactsListScreen } from '../screens/contacts/ContactsListScreen';
import { useTheme } from '../shared/theme';
import { createStackScreenOptions, DETAIL_SCREEN_OPTIONS } from './screenOptions';
import type { ContactsStackParamList } from './types';

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export function ContactsStackNavigator() {
  const { colors } = useTheme();
  const screenOptions = useMemo(() => createStackScreenOptions(colors), [colors]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ContactsList" component={ContactsListScreen} options={{ title: 'Contacts' }} />
      <Stack.Screen
        name="ContactDetail"
        component={ContactDetailScreen}
        options={{ title: 'Contact', ...DETAIL_SCREEN_OPTIONS }}
      />
    </Stack.Navigator>
  );
}
