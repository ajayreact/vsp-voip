import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React, { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useAppStore } from '../store/appStore';
import { useTheme } from '../shared/theme';
import { tokens } from '../shared/theme';
import { TAB_SCREEN_OPTIONS } from './screenOptions';
import { RecentStackNavigator } from './RecentStackNavigator';
import { ContactsStackNavigator } from './ContactsStackNavigator';
import { MessagesStackNavigator } from './MessagesStackNavigator';
import { AiStackNavigator } from './AiStackNavigator';
import { VSP_AI_BRANDING } from '../ai/vspAiBranding';
import { YouStackNavigator } from './YouStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabIconProps = { focused: boolean; color: string; size: number };

function tabIcon(name: keyof typeof Ionicons.glyphMap, focusedName?: keyof typeof Ionicons.glyphMap) {
  return ({ focused, color, size }: TabIconProps) => (
    <Ionicons name={focused && focusedName ? focusedName : name} size={size - 1} color={color} />
  );
}

const HOME_ICON = tabIcon('home-outline', 'home');
const RECENT_ICON = tabIcon('time-outline', 'time');
const CONTACTS_ICON = tabIcon('people-outline', 'people');
const KEYPAD_ICON = tabIcon('keypad-outline', 'keypad');
const TEXT_ICON = tabIcon('chatbubble-ellipses-outline', 'chatbubble-ellipses');
const AI_ICON = tabIcon('sparkles-outline', 'sparkles');
const YOU_ICON = tabIcon('person-circle-outline', 'person-circle');

export function MainTabNavigator() {
  const { colors } = useTheme();
  const unreadSms = useAppStore((s) => s.dashboardStats?.unreadSmsCount ?? 0);

  const screenOptions = useMemo(
    () => ({
      ...TAB_SCREEN_OPTIONS,
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.tabInactive,
      tabBarLabelStyle: styles.tabLabel,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        height: Platform.OS === 'ios' ? 84 : 64,
        paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        paddingTop: 8,
        ...tokens.shadow.card,
      },
    }),
    [colors.border, colors.primary, colors.surface, colors.tabInactive],
  );

  const textOptions = useMemo(
    () => ({
      tabBarIcon: TEXT_ICON,
      title: 'Text',
      tabBarBadge: unreadSms > 0 ? unreadSms : undefined,
    }),
    [unreadSms],
  );

  return (
    <Tab.Navigator initialRouteName="Home" screenOptions={screenOptions}>
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{ tabBarIcon: HOME_ICON, title: 'Home' }}
      />
      <Tab.Screen
        name="Recent"
        component={RecentStackNavigator}
        options={{ tabBarIcon: RECENT_ICON, title: 'Recent' }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsStackNavigator}
        options={{ tabBarIcon: CONTACTS_ICON }}
      />
      <Tab.Screen
        name="Keypad"
        getComponent={() => require('../screens/calls/DialPadScreen').DialPadScreen}
        options={{ tabBarIcon: KEYPAD_ICON, title: 'Keypad' }}
      />
      <Tab.Screen name="Text" component={MessagesStackNavigator} options={textOptions} />
      <Tab.Screen
        name="AI"
        component={AiStackNavigator}
        options={{ tabBarIcon: AI_ICON, title: VSP_AI_BRANDING.tabTitle }}
      />
      <Tab.Screen name="You" component={YouStackNavigator} options={{ tabBarIcon: YOU_ICON }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
