import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AiStackParamList } from './types';
import { VSP_AI_BRANDING } from '../ai/vspAiBranding';
import { useStackScreenOptions } from '../hooks/useStackScreenOptions';

const Stack = createNativeStackNavigator<AiStackParamList>();

export function AiStackNavigator() {
  const { screenOptions } = useStackScreenOptions();
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="AssistantHome"
        getComponent={() => require('../screens/assistant/AssistantScreen').AssistantScreen}
        options={{ headerShown: false, title: VSP_AI_BRANDING.productName }}
      />
    </Stack.Navigator>
  );
}
