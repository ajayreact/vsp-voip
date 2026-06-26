import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ContactDetailScreen } from '../screens/contacts/ContactDetailScreen';
import { ContactsListScreen } from '../screens/contacts/ContactsListScreen';
import { useTheme } from '../shared/theme';
import type { ContactsStackParamList } from './types';

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export function ContactsStackNavigator() {
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
      <Stack.Screen name="ContactsList" component={ContactsListScreen} options={{ title: 'Contacts' }} />
      <Stack.Screen
        name="ContactDetail"
        component={ContactDetailScreen}
        options={{ title: 'Contact' }}
      />
    </Stack.Navigator>
  );
}
