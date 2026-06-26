import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { VoicemailDetailScreen } from '../screens/voicemail/VoicemailDetailScreen';
import { VoicemailListScreen } from '../screens/voicemail/VoicemailListScreen';
import { useTheme } from '../shared/theme';
import type { VoicemailStackParamList } from './types';

const Stack = createNativeStackNavigator<VoicemailStackParamList>();

export function VoicemailStackNavigator() {
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
      <Stack.Screen name="VoicemailList" component={VoicemailListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VoicemailDetail" component={VoicemailDetailScreen} options={{ title: 'Voicemail' }} />
    </Stack.Navigator>
  );
}
