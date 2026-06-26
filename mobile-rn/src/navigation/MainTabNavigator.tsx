import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../shared/theme';
import { CallsStackNavigator } from './CallsStackNavigator';
import { ContactsStackNavigator } from './ContactsStackNavigator';
import { DashboardStackNavigator } from './DashboardStackNavigator';
import { MessagesStackNavigator } from './MessagesStackNavigator';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { VoicemailStackNavigator } from './VoicemailStackNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconProps = { focused: boolean; color: string; size: number };

function tabIcon(name: keyof typeof Ionicons.glyphMap, focusedName?: keyof typeof Ionicons.glyphMap) {
  return ({ focused, color, size }: TabIconProps) => (
    <Ionicons name={focused && focusedName ? focusedName : name} size={size - 2} color={color} />
  );
}

export function MainTabNavigator() {
  const { colors } = useTheme();
  const unreadSms = useAppStore((s) => s.dashboardStats?.unreadSmsCount ?? 0);
  const unreadVm = useAppStore((s) => s.dashboardStats?.unreadVoicemailCount ?? 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNavigator}
        options={{
          tabBarIcon: tabIcon('analytics-outline', 'analytics'),
          title: 'Home',
        }}
      />
      <Tab.Screen
        name="Calls"
        component={CallsStackNavigator}
        options={{
          tabBarIcon: tabIcon('headset-outline', 'headset'),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStackNavigator}
        options={{
          tabBarIcon: tabIcon('mail-outline', 'mail'),
          tabBarBadge: unreadSms > 0 ? unreadSms : undefined,
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsStackNavigator}
        options={{
          tabBarIcon: tabIcon('id-card-outline', 'id-card'),
        }}
      />
      <Tab.Screen
        name="Voicemail"
        component={VoicemailStackNavigator}
        options={{
          tabBarIcon: tabIcon('recording-outline', 'recording'),
          tabBarBadge: unreadVm > 0 ? unreadVm : undefined,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          tabBarIcon: tabIcon('options-outline', 'options'),
        }}
      />
    </Tab.Navigator>
  );
}
