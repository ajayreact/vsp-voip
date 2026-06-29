import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { YouScreen } from '../screens/you/YouScreen';
import { useStackScreenOptions } from '../hooks/useStackScreenOptions';
import type { YouStackParamList } from './types';

const Stack = createNativeStackNavigator<YouStackParamList>();

export function YouStackNavigator() {
  const { screenOptions, detailOptions } = useStackScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="YouHome" component={YouScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Profile"
        getComponent={() => require('../screens/settings/ProfileScreen').ProfileScreen}
        options={{ title: 'Profile', ...detailOptions }}
      />
      <Stack.Screen
        name="Organization"
        getComponent={() => require('../screens/you/OrganizationScreen').OrganizationScreen}
        options={{ title: 'Company', ...detailOptions }}
      />
      <Stack.Screen
        name="Extensions"
        getComponent={() => require('../screens/you/ExtensionsScreen').ExtensionsScreen}
        options={{ title: 'Extension', ...detailOptions }}
      />
      <Stack.Screen
        name="Numbers"
        getComponent={() => require('../screens/you/NumbersScreen').NumbersScreen}
        options={{ title: 'Business DID', ...detailOptions }}
      />
      <Stack.Screen
        name="SipConfiguration"
        getComponent={() => require('../screens/settings/SipConfigurationScreen').SipConfigurationScreen}
        options={{ title: 'SIP Configuration', ...detailOptions }}
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
        name="SettingsDevices"
        getComponent={() => require('../screens/settings/SettingsDevicesScreen').SettingsDevicesScreen}
        options={{ title: 'Devices', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsDeviceInfo"
        getComponent={() => require('../screens/settings/SettingsDeviceInfoScreen').SettingsDeviceInfoScreen}
        options={{ title: 'Device Information', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsCalling"
        getComponent={() => require('../screens/settings/SettingsCallingScreen').SettingsCallingScreen}
        options={{ title: 'Calling', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsVoicemail"
        getComponent={() => require('../screens/settings/SettingsVoicemailScreen').SettingsVoicemailScreen}
        options={{ title: 'Voicemail', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsMessaging"
        getComponent={() => require('../screens/settings/SettingsMessagingScreen').SettingsMessagingScreen}
        options={{ title: 'Messaging', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsSecurity"
        getComponent={() => require('../screens/settings/SettingsSecurityScreen').SettingsSecurityScreen}
        options={{ title: 'Security', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsDiagnostics"
        getComponent={() => require('../screens/settings/SettingsDiagnosticsScreen').SettingsDiagnosticsScreen}
        options={{ title: 'Diagnostics', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsSupport"
        getComponent={() => require('../screens/settings/SettingsSupportScreen').SettingsSupportScreen}
        options={{ title: 'Support', ...detailOptions }}
      />
      <Stack.Screen
        name="SettingsChangePassword"
        getComponent={() => require('../screens/settings/SettingsChangePasswordScreen').SettingsChangePasswordScreen}
        options={{ title: 'Change Password', ...detailOptions }}
      />
      <Stack.Screen
        name="QrProvision"
        getComponent={() => require('../screens/QrLoginScreen').QrLoginScreen}
        options={{ title: 'QR Provisioning', ...detailOptions }}
      />
      <Stack.Screen
        name="About"
        getComponent={() => require('../screens/settings/AboutScreen').AboutScreen}
        options={{ title: 'About' }}
      />
      <Stack.Screen name="VoicemailList" getComponent={() => require('../screens/voicemail/VoicemailListScreen').VoicemailListScreen} options={{ title: 'Voicemail' }} />
      <Stack.Screen name="VoicemailDetail" getComponent={() => require('../screens/voicemail/VoicemailDetailScreen').VoicemailDetailScreen} options={{ title: 'Voicemail', ...detailOptions }} />
    </Stack.Navigator>
  );
}

/** @deprecated Use YouStackNavigator */
export const SettingsStackNavigator = YouStackNavigator;
