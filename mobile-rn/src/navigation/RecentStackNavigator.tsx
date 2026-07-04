import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { RecentCallsScreen } from '../screens/calls/RecentCallsScreen';
import { useStackScreenOptions } from '../hooks/useStackScreenOptions';
import type { RecentStackParamList } from './types';

const Stack = createNativeStackNavigator<RecentStackParamList>();

export function RecentStackNavigator() {
  const { screenOptions, detailOptions } = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="RecentMain" component={RecentCallsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="CallDetails"
        getComponent={() => require('../screens/calls/CallDetailsScreen').CallDetailsScreen}
        options={{ title: 'Call Details', ...detailOptions }}
      />
    </Stack.Navigator>
  );
}

/** @deprecated Use RecentStackNavigator */
export const CallsStackNavigator = RecentStackNavigator;
