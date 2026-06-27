import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { YouScreen } from '../screens/you/YouScreen';
import { VoicemailListScreen } from '../screens/voicemail/VoicemailListScreen';
import { VoicemailDetailScreen } from '../screens/voicemail/VoicemailDetailScreen';
import { useTheme } from '../shared/theme';
import { createStackScreenOptions, DETAIL_SCREEN_OPTIONS } from './screenOptions';
import type { YouStackParamList } from './types';

const Stack = createNativeStackNavigator<YouStackParamList>();

export function YouStackNavigator() {
  const { colors } = useTheme();
  const screenOptions = useMemo(() => createStackScreenOptions(colors), [colors]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="YouHome" component={YouScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Profile"
        getComponent={() => require('../screens/settings/ProfileScreen').ProfileScreen}
        options={{ title: 'Profile', ...DETAIL_SCREEN_OPTIONS }}
      />
      <Stack.Screen
        name="Organization"
        getComponent={() => require('../screens/you/OrganizationScreen').OrganizationScreen}
        options={{ title: 'Organization', ...DETAIL_SCREEN_OPTIONS }}
      />
      <Stack.Screen
        name="Extensions"
        getComponent={() => require('../screens/you/ExtensionsScreen').ExtensionsScreen}
        options={{ title: 'Extensions', ...DETAIL_SCREEN_OPTIONS }}
      />
      <Stack.Screen
        name="Numbers"
        getComponent={() => require('../screens/you/NumbersScreen').NumbersScreen}
        options={{ title: 'Numbers', ...DETAIL_SCREEN_OPTIONS }}
      />
      <Stack.Screen
        name="SipConfiguration"
        getComponent={() => require('../screens/settings/SipConfigurationScreen').SipConfigurationScreen}
        options={{ title: 'SIP Configuration', ...DETAIL_SCREEN_OPTIONS }}
      />
      <Stack.Screen
        name="Theme"
        getComponent={() => require('../screens/settings/ThemeScreen').ThemeScreen}
        options={{ title: 'Appearance' }}
      />
      <Stack.Screen
        name="Notifications"
        getComponent={() => require('../screens/settings/NotificationsScreen').NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="About"
        getComponent={() => require('../screens/settings/AboutScreen').AboutScreen}
        options={{ title: 'About' }}
      />
      <Stack.Screen name="VoicemailList" component={VoicemailListScreen} options={{ title: 'Voicemail' }} />
      <Stack.Screen name="VoicemailDetail" component={VoicemailDetailScreen} options={{ title: 'Voicemail', ...DETAIL_SCREEN_OPTIONS }} />
    </Stack.Navigator>
  );
}

/** @deprecated Use YouStackNavigator */
export const SettingsStackNavigator = YouStackNavigator;
