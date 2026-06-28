import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, LoadingOverlay } from '../components';
import { parseQrLoginPayload, validateQrPayload } from '../auth/qrLogin';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../shared/theme';
import { spacing, typography } from '../shared/theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'QrLogin'>;

export function QrLoginScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { loginWithQrToken, isSubmitting, clearError } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleScan = useCallback(
    async ({ data }: { data: string }) => {
      if (scanned || isSubmitting) return;
      setScanned(true);
      clearError();
      setMessage(null);

      const payload = parseQrLoginPayload(data);
      if (!payload) {
        setMessage("This QR code isn't valid for VSP Phone. Please try again or sign in manually.");
        setScanned(false);
        return;
      }

      const validationError = validateQrPayload(payload);
      if (validationError) {
        setMessage(validationError);
        setScanned(false);
        return;
      }

      try {
        await loginWithQrToken(payload.token!);
      } catch {
        setMessage("We couldn't sign you in with this QR code. It may have expired.");
        setScanned(false);
      }
    },
    [clearError, isSubmitting, loginWithQrToken, scanned],
  );

  if (!permission) {
    return <View style={[styles.center, { backgroundColor: colors.background }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.help, { color: colors.textMuted }]}>
          Camera access is needed to scan your organization login QR code.
        </Text>
        <Button label="Allow camera" onPress={requestPermission} style={{ marginTop: spacing.lg }} />
        <Button label="Back to sign in" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LoadingOverlay visible={isSubmitting} />
      <Text style={[styles.help, { color: colors.textMuted }]}>
        Point your camera at the QR code from your administrator.
      </Text>
      <View style={[styles.cameraWrap, { borderColor: colors.border }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleScan}
        />
        <View style={[styles.frame, { borderColor: colors.primary }]} />
      </View>
      {message ? <Text style={[styles.error, { color: colors.error }]}>{message}</Text> : null}
      {scanned && !isSubmitting ? (
        <Button label="Scan again" variant="secondary" onPress={() => setScanned(false)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  help: { ...typography.body, textAlign: 'center' },
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
  error: { ...typography.caption, textAlign: 'center' },
});
