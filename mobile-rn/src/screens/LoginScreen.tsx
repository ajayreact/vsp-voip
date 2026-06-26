import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button, LoadingOverlay, Screen, TextField } from '../components';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';

export function LoginScreen() {
  const { login, isSubmitting, error, clearError } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit() {
    clearError();
    await login(email, password);
  }

  return (
    <Screen scroll>
      <LoadingOverlay visible={isSubmitting} />
      <Text style={[styles.title, { color: colors.text }]}>VSP Phone</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Sign in to your organization account
      </Text>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoComplete="email"
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

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Button
        label="Sign in"
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={!email || !password}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  error: {
    ...typography.caption,
  },
});
