import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { CallsHubScreen } from '../screens/calls/CallsHubScreen';
import { useTheme } from '../shared/theme';
import type { CallsStackParamList } from './types';

const Stack = createNativeStackNavigator<CallsStackParamList>();

export function CallsStackNavigator() {
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
      <Stack.Screen name="CallsHub" component={CallsHubScreen} options={{ title: 'Calls' }} />
    </Stack.Navigator>
  );
}
