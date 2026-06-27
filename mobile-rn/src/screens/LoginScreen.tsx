import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const cardWidth = useMemo(() => {
    if (width >= 768) return Math.min(440, width * 0.55);
    return width - spacing.lg * 2;
  }, [width]);

  async function handleSubmit() {
    clearError();
    await login(username.trim(), password);
  }

  const friendlyError = error ? getFriendlyErrorMessage(new Error(error)) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LoadingOverlay visible={isSubmitting} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={[styles.inner, { maxWidth: cardWidth }]}>
            <View style={styles.brandBlock}>
              <View style={[styles.logoWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="call" size={32} color={colors.primary} accessibilityElementsHidden />
              </View>
              <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
                VSP Phone
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Enterprise calling for your organization
              </Text>
            </View>

            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  width: cardWidth,
                },
              ]}
            >
              <TextField
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="Email or username"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                accessibilityLabel="Username"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
                accessibilityLabel="Password"
              />

              {friendlyError ? (
                <View
                  style={[styles.errorBox, { backgroundColor: colors.errorSoft, borderColor: colors.error }]}
                  accessibilityRole="alert"
                >
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                  <Text style={[styles.error, { color: colors.error }]}>{friendlyError}</Text>
                </View>
              ) : null}

              <Button
                label="Sign in"
                onPress={() => void handleSubmit()}
                loading={isSubmitting}
                disabled={!username.trim() || !password}
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

            <Text style={[styles.footer, { color: colors.textMuted }]}>
              Secured by your organization portal
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    ...tokens.shadow.card,
  },
  title: {
    ...typography.display,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  card: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...tokens.shadow.card,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    padding: spacing.sm,
  },
  error: {
    ...typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  loginBtn: { marginTop: spacing.xs, minHeight: 52 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { ...typography.caption, fontWeight: '700', letterSpacing: 1 },
  qrBtn: { minHeight: 52 },
  footer: {
    ...typography.caption,
    textAlign: 'center',
  },
});
