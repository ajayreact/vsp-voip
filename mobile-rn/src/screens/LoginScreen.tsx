import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Button, LoadingOverlay, TextField } from '../components';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../shared/theme';
import { spacing, tokens, typography } from '../shared/theme';
import type { AuthStackParamList } from '../navigation/types';
import { getFriendlyErrorMessage } from '../utils/friendlyError';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login, isSubmitting, error, clearError } = useAuth();
  const { colors } = useTheme();
  const [orgUrl, setOrgUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit() {
    clearError();
    await login(username, password);
  }

  const friendlyError = error ? getFriendlyErrorMessage(new Error(error)) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LoadingOverlay visible={isSubmitting} />
      <View style={styles.header}>
        <View style={[styles.logoWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="call" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>VSP Phone</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Enterprise calling for your organization
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextField
          label="Organization URL"
          value={orgUrl}
          onChangeText={setOrgUrl}
          placeholder="your-company.vspphone.com"
          autoCapitalize="none"
          autoComplete="url"
        />
        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          keyboardType="email-address"
          autoComplete="username"
          textContentType="username"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
        />

        {friendlyError ? (
          <Text style={[styles.error, { color: colors.error }]}>{friendlyError}</Text>
        ) : null}

        <Button
          label="Sign in"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!username || !password}
          style={styles.loginBtn}
        />

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>OR</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <Button
          label="Scan QR Code"
          variant="secondary"
          onPress={() => navigation.navigate('QrLogin')}
          style={styles.qrBtn}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.display, fontSize: 28 },
  subtitle: { ...typography.body, textAlign: 'center' },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    ...tokens.shadow.card,
  },
  error: { ...typography.caption, marginTop: spacing.xs },
  loginBtn: { marginTop: spacing.sm },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.md },
  divider: { flex: 1, height: 1 },
  dividerText: { ...typography.caption, fontWeight: '600' },
  qrBtn: { minHeight: 52 },
});
