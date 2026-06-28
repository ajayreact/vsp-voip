import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { RecentCallsScreen } from '../screens/calls/RecentCallsScreen';
import { CallDetailsScreen } from '../screens/calls/CallDetailsScreen';
import { useTheme } from '../shared/theme';
import { createStackScreenOptions, DETAIL_SCREEN_OPTIONS } from './screenOptions';
import type { RecentStackParamList } from './types';

const Stack = createNativeStackNavigator<RecentStackParamList>();

export function RecentStackNavigator() {
  const { colors } = useTheme();
  const screenOptions = useMemo(() => createStackScreenOptions(colors), [colors]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="RecentMain" component={RecentCallsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="CallDetails"
        component={CallDetailsScreen}
        options={{ title: 'Call Details', ...DETAIL_SCREEN_OPTIONS }}
      />
    </Stack.Navigator>
  );
}

/** @deprecated Use RecentStackNavigator */
export const CallsStackNavigator = RecentStackNavigator;
