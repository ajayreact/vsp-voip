import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, LoadingOverlay } from '../components';
import {
  classifyQrPayload,
  getDeskQrMessage,
  getInvalidQrMessage,
  mapProvisionError,
} from '../auth/provisionErrors';
import { parseQrLoginPayload, validateQrPayload } from '../auth/qrLogin';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../shared/theme';
import { spacing, tokens, typography } from '../shared/theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'QrLogin'>;
type ScanPhase = 'idle' | 'validating' | 'provisioning';

export function QrLoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { provisionWithQr, isSubmitting, clearError } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const resetScanner = useCallback(() => {
    setScanPhase('idle');
    setMessage(null);
    clearError();
  }, [clearError]);

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      if (scanPhase !== 'idle' || isSubmitting) return;

      setScanPhase('validating');
      clearError();
      setMessage(null);

      const payload = parseQrLoginPayload(data);
      const qrKind = classifyQrPayload(payload);

      if (qrKind === 'invalid') {
        setMessage(getInvalidQrMessage());
        setScanPhase('idle');
        return;
      }

      if (qrKind === 'desk') {
        setMessage(getDeskQrMessage());
        setScanPhase('idle');
        return;
      }

      const validationError = validateQrPayload(payload!);
      if (validationError) {
        setMessage(validationError);
        setScanPhase('idle');
        return;
      }

      setScanPhase('provisioning');
      try {
        await provisionWithQr(payload!);
      } catch (error) {
        setMessage(mapProvisionError(error));
        setScanPhase('idle');
      }
    },
    [clearError, isSubmitting, provisionWithQr, scanPhase],
  );

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();
    setPermissionDenied(!result.granted && !result.canAskAgain);
  }, [requestPermission]);

  if (!permission) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.help, { color: colors.textMuted }]}>Preparing camera…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="camera-outline" size={32} color={colors.primary} />
        </View>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera access required</Text>
        <Text style={[styles.help, { color: colors.textMuted }]}>
          Camera access is needed to scan your organization login QR code.
        </Text>
        {permissionDenied ? (
          <Text style={[styles.help, { color: colors.textMuted }]}>
            Camera permission was denied. Enable it in system settings to continue.
          </Text>
        ) : null}
        {!permissionDenied ? (
          <Button label="Allow camera" onPress={() => void handleRequestPermission()} style={styles.actionBtn} />
        ) : (
          <Button
            label="Open settings"
            onPress={() => void Linking.openSettings()}
            style={styles.actionBtn}
          />
        )}
        <Button label="Back to sign in" variant="ghost" onPress={() => navigation.goBack()} />
      </SafeAreaView>
    );
  }

  const overlayMessage =
    scanPhase === 'validating'
      ? 'Reading QR code…'
      : scanPhase === 'provisioning' || isSubmitting
        ? 'Provisioning your device…'
        : undefined;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <LoadingOverlay visible={Boolean(overlayMessage)} message={overlayMessage} />
      <Text style={[styles.help, { color: colors.textMuted }]}>
        Point your camera at the QR code from your administrator.
      </Text>
      <View style={[styles.cameraWrap, { borderColor: colors.border }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanPhase === 'idle' ? handleScan : undefined}
        />
        <View style={[styles.frame, { borderColor: colors.primary }]} />
        {scanPhase !== 'idle' ? (
          <View style={styles.scanOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}
      </View>

      {message ? (
        <View
          style={[styles.errorBox, { backgroundColor: colors.errorSoft, borderColor: colors.error }]}
          accessibilityRole="alert"
        >
          <Ionicons name="alert-circle" size={18} color={colors.error} />
          <Text style={[styles.error, { color: colors.error }]}>{message}</Text>
        </View>
      ) : null}

      {message ? (
        <Button label="Scan again" variant="secondary" onPress={resetScanner} style={styles.actionBtn} />
      ) : null}

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {Platform.OS === 'ios' ? 'Hold steady in good lighting.' : 'Center the QR code inside the frame.'}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: { ...typography.title, textAlign: 'center' },
  help: { ...typography.body, textAlign: 'center', maxWidth: 320 },
  hint: { ...typography.caption, textAlign: 'center' },
  cameraWrap: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 320,
  },
  frame: {
    position: 'absolute',
    top: '20%',
    left: '12%',
    right: '12%',
    bottom: '20%',
    borderWidth: 3,
    borderRadius: 16,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    padding: spacing.sm,
  },
  error: { ...typography.caption, flex: 1, lineHeight: 18 },
  actionBtn: { minHeight: 48 },
});
