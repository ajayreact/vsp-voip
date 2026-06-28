import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { LoginScreen } from '../screens/LoginScreen';
import { useTheme } from '../shared/theme';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen
        name="QrLogin"
        getComponent={() => require('../screens/QrLoginScreen').QrLoginScreen}
        options={{ headerShown: true, title: 'Scan QR Code' }}
      />
    </Stack.Navigator>
  );
}
