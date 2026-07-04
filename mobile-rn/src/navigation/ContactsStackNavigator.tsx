import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ContactsListScreen } from '../screens/contacts/ContactsListScreen';
import { useStackScreenOptions } from '../hooks/useStackScreenOptions';
import type { ContactsStackParamList } from './types';

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export function ContactsStackNavigator() {
  const { screenOptions, detailOptions } = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ContactsList" component={ContactsListScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ContactDetail"
        getComponent={() => require('../screens/contacts/ContactDetailScreen').ContactDetailScreen}
        options={{ title: 'Contact', ...detailOptions }}
      />
      <Stack.Screen
        name="CustomerContactDetail"
        getComponent={() => require('../screens/contacts/CustomerContactDetailScreen').CustomerContactDetailScreen}
        options={{ title: 'Customer', ...detailOptions }}
      />
      <Stack.Screen
        name="CustomerContactForm"
        getComponent={() => require('../screens/contacts/CustomerContactFormScreen').CustomerContactFormScreen}
        options={{ title: 'Customer Contact', ...detailOptions }}
      />
    </Stack.Navigator>
  );
}
