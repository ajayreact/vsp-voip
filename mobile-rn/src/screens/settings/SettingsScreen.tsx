import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ListItem } from '../../components';
import type { SettingsStackParamList } from '../../navigation/types';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

export function SettingsScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {user?.name} · {user?.tenantName || user?.email}
        </Text>
      </View>

      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ListItem title="Profile" subtitle="Account and organization" onPress={() => navigation.navigate('Profile')} />
        <ListItem title="Theme" subtitle="Appearance preferences" onPress={() => navigation.navigate('Theme')} />
        <ListItem
          title="Notifications"
          subtitle="Alert preferences"
          onPress={() => navigation.navigate('Notifications')}
        />
        <ListItem title="About" subtitle="App information" onPress={() => navigation.navigate('About')} />
      </View>

      <View style={styles.logoutWrap}>
        <ListItem title="Sign out" onPress={() => logout()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  title: { ...typography.title },
  subtitle: { ...typography.body },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoutWrap: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
  },
});
