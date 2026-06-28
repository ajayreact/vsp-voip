import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import { Button, LoadingOverlay, LoadingScreen, SearchBar } from '../../components';
import {
  SipCodecList,
  SipConnectionStatus,
  SipFieldRow,
  SipPasswordField,
  SipSectionCard,
  SipSelectField,
  SipToggleField,
} from '../../components/sip';
import { useAuth } from '../../hooks/useAuth';
import { useCallingStore } from '../../store/callingStore';
import {
  FIELD_TOOLTIPS,
  SIP_SECTIONS,
  buildServerInfoBlock,
  friendlySipError,
  hydrateSipProfile,
  importSipProfileJson,
  loadStoredSipProfile,
  parseSipQrPayload,
  profileToExportJson,
  profileToGrandstreamJson,
  saveStoredSipProfile,
  testSipConnection,
  validateSipProfile,
  validateSipQrPayload,
} from '../../sip';
import { parseMobileProvisionQr, redeemDeskProvisioningQr } from '../../auth/provisionService';
import { sipProfileFromProvisioningProfile } from '../../sip/provisioningProfile';
import type { DtmfMode, LogLevel, NatTraversal, SessionRefresh, SipProfile, SipSectionId, SipTransport, SrtpMode, TlsVersion } from '../../sip/types';
import { useTheme } from '../../shared/theme';
import { spacing, typography } from '../../shared/theme';

const TRANSPORT_OPTIONS: SipTransport[] = ['UDP', 'TCP', 'TLS'];
const DTMF_OPTIONS: DtmfMode[] = ['RFC2833', 'SIP INFO', 'In-band'];
const NAT_OPTIONS: NatTraversal[] = ['None', 'STUN', 'ICE', 'TURN'];
const SRTP_OPTIONS: SrtpMode[] = ['Disabled', 'Optional', 'Mandatory'];
const TLS_OPTIONS: TlsVersion[] = ['TLS 1.2', 'TLS 1.3'];
const SESSION_REFRESH_OPTIONS: SessionRefresh[] = ['UAC', 'UAS', 'Disabled'];
const LOG_LEVEL_OPTIONS: LogLevel[] = ['ERROR', 'WARNING', 'INFO', 'DEBUG'];

function showTooltip(label: string, key: string) {
  const text = FIELD_TOOLTIPS[key];
  if (text) Alert.alert(label, text);
}

function patchProfile(profile: SipProfile, patch: Partial<SipProfile>): SipProfile {
  return { ...profile, ...patch };
}

function sectionVisible(sectionId: SipSectionId, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const section = SIP_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return true;
  return section.title.toLowerCase().includes(q) || section.keywords.some((kw) => kw.includes(q) || q.includes(kw));
}

export function SipConfigurationScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const retryRegistration = useCallingStore((s) => s.retryRegistration);

  const [profile, setProfile] = useState<SipProfile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrScanned, setQrScanned] = useState(false);
  const [registrationExpiryAt, setRegistrationExpiryAt] = useState<number | null>(null);
  const [lastRegistrationAt, setLastRegistrationAt] = useState<number | null>(null);
  const [roundTripLatencyMs, setRoundTripLatencyMs] = useState<number | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const stored = await loadStoredSipProfile();
      const hydrated = await hydrateSipProfile({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        stored,
      });
      setProfile(hydrated);
    } catch (error) {
      Alert.alert('SIP Configuration', friendlySipError(error));
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.name, user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback((patch: Partial<SipProfile>) => {
    setProfile((current) => (current ? patchProfile(current, patch) : current));
    setErrors({});
  }, []);

  const onTransportChange = (transport: SipTransport) => {
    const sipPort = transport === 'TLS' ? '5061' : '5060';
    const outboundProxy = profile
      ? `${profile.sipServer}:${sipPort}`
      : '';
    update({ transport, sipPort, outboundProxy });
  };

  const handleSave = useCallback(async (andRegister = false) => {
    if (!profile) return;
    const validation = validateSipProfile(profile);
    setErrors(validation.errors);
    if (!validation.valid) {
      Alert.alert('Validation', 'Fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await saveStoredSipProfile(profile);
      setMessage('SIP profile saved.');
      if (andRegister) {
        setRegistering(true);
        retryRegistration();
        setLastRegistrationAt(Date.now());
        setRegistrationExpiryAt(Date.now() + Number(profile.registrationExpirySec) * 1000);
      }
    } catch (error) {
      Alert.alert('Save failed', friendlySipError(error));
    } finally {
      setSaving(false);
      setRegistering(false);
    }
  }, [profile, retryRegistration]);

  const handleTest = useCallback(async () => {
    if (!profile) return;
    const validation = validateSipProfile(profile);
    setErrors(validation.errors);
    if (!validation.valid) {
      Alert.alert('Validation', 'Fix the highlighted fields before testing the connection.');
      return;
    }

    setTesting(true);
    setMessage(null);
    try {
      const result = await testSipConnection();
      setRoundTripLatencyMs(result.latencyMs);
      if (result.ok) {
        setMessage(result.message);
        setLastRegistrationAt(Date.now());
        setRegistrationExpiryAt(Date.now() + Number(profile.registrationExpirySec) * 1000);
      } else {
        Alert.alert('Connection test', friendlySipError(result.message));
      }
    } catch (error) {
      Alert.alert('Connection test', friendlySipError(error));
    } finally {
      setTesting(false);
    }
  }, [profile]);

  const handleExport = useCallback(async (grandstream = false) => {
    if (!profile) return;
    const payload = grandstream ? profileToGrandstreamJson(profile) : profileToExportJson(profile);
    await Share.share({ message: payload, title: grandstream ? 'Grandstream SIP Profile' : 'VSP SIP Profile' });
  }, [profile]);

  const handleImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const response = await fetch(result.assets[0].uri);
      const raw = await response.text();
      const imported = importSipProfileJson(raw);
      setProfile(imported);
      setMessage('SIP profile imported.');
    } catch (error) {
      Alert.alert('Import failed', friendlySipError(error));
    }
  }, []);

  const handleCopyServerInfo = useCallback(async () => {
    if (!profile) return;
    await Share.share({ message: buildServerInfoBlock(profile), title: 'SIP Server Information' });
  }, [profile]);

  const handleQrScan = useCallback(async ({ data }: { data: string }) => {
    if (qrScanned) return;
    setQrScanned(true);

    const tokenPayload = parseMobileProvisionQr(data);
    if (tokenPayload?.type === 'vsp-desk-provision' && tokenPayload.token) {
      try {
        const provisioningProfile = await redeemDeskProvisioningQr(data);
        if (!provisioningProfile) {
          throw new Error('Desk provisioning profile was empty.');
        }
        const imported = sipProfileFromProvisioningProfile(provisioningProfile);
        setProfile((current) => ({ ...(current ?? imported), ...imported }));
        setMessage('Desk SIP profile loaded from secure QR.');
        setQrOpen(false);
      } catch (error) {
        Alert.alert('QR import failed', friendlySipError(error));
      } finally {
        setQrScanned(false);
      }
      return;
    }

    const payload = parseSipQrPayload(data);
    if (!payload) {
      Alert.alert('Invalid QR', 'This QR code is not a valid SIP provisioning code.');
      setQrScanned(false);
      return;
    }
    const validationError = validateSipQrPayload(payload);
    if (validationError) {
      Alert.alert('Invalid QR', validationError);
      setQrScanned(false);
      return;
    }
    try {
      const imported = importSipProfileJson(JSON.stringify(payload));
      setProfile((current) => ({ ...(current ?? imported), ...imported }));
      setMessage('SIP profile updated from QR code.');
      setQrOpen(false);
    } catch (error) {
      Alert.alert('QR import failed', friendlySipError(error));
    } finally {
      setQrScanned(false);
    }
  }, [qrScanned]);

  const openQrScanner = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera required', 'Allow camera access to scan SIP provisioning QR codes.');
        return;
      }
    }
    setQrScanned(false);
    setQrOpen(true);
  }, [cameraPermission?.granted, requestCameraPermission]);

  const visible = useMemo(() => {
    const checker = (id: SipSectionId) => sectionVisible(id, search);
    return {
      account: checker('account'),
      server: checker('server'),
      network: checker('network'),
      codecs: checker('codecs'),
      dtmf: checker('dtmf'),
      nat: checker('nat'),
      security: checker('security'),
      audio: checker('audio'),
      callFeatures: checker('callFeatures'),
      voicemail: checker('voicemail'),
      advanced: checker('advanced'),
      logging: checker('logging'),
      status: checker('status'),
    };
  }, [search]);

  if (loading || !profile) {
    return <LoadingScreen message="Loading SIP configuration…" />;
  }

  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LoadingOverlay visible={saving || testing || registering} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search settings…"
          accessibilityLabel="Search SIP settings"
        />

        {message ? (
          <Text style={[styles.banner, { color: colors.primary, backgroundColor: colors.primarySoft }]}>
            {message}
          </Text>
        ) : null}

        <View style={styles.quickActions}>
          <Button label="Import JSON" variant="secondary" onPress={() => void handleImport()} />
          <Button label="Export JSON" variant="secondary" onPress={() => void handleExport(false)} />
          <Button label="Scan QR" variant="secondary" onPress={() => void openQrScanner()} />
          <Button label="Copy server info" variant="ghost" onPress={() => void handleCopyServerInfo()} />
        </View>

        {visible.status ? (
          <SipSectionCard title="Connection Status">
            <SipConnectionStatus
              profile={profile}
              registrationExpiryAt={registrationExpiryAt}
              lastRegistrationAt={lastRegistrationAt}
              roundTripLatencyMs={roundTripLatencyMs}
            />
          </SipSectionCard>
        ) : null}

        {visible.account ? (
          <SipSectionCard title="Account">
            <SipFieldRow
              label="Profile Name"
              tooltip="i"
              onTooltipPress={() => showTooltip('Profile Name', 'profileName')}
              error={errors.profileName}
            >
              <TextInput
                value={profile.profileName}
                onChangeText={(profileName) => update({ profileName })}
                style={[inputStyle, errors.profileName && { borderColor: colors.error }]}
              />
            </SipFieldRow>
            <SipFieldRow label="Display Name" onTooltipPress={() => showTooltip('Display Name', 'displayName')}>
              <TextInput value={profile.displayName} onChangeText={(displayName) => update({ displayName })} style={inputStyle} />
            </SipFieldRow>
            <SipFieldRow label="Extension">
              <TextInput value={profile.extension} onChangeText={(extension) => update({ extension })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
            <SipFieldRow
              label="SIP Username"
              onTooltipPress={() => showTooltip('SIP Username', 'sipUsername')}
              error={errors.sipUsername}
            >
              <TextInput
                value={profile.sipUsername}
                onChangeText={(sipUsername) => update({ sipUsername })}
                style={[inputStyle, errors.sipUsername && { borderColor: colors.error }]}
                autoCapitalize="none"
              />
            </SipFieldRow>
            <SipFieldRow label="Authentication Username" onTooltipPress={() => showTooltip('Authentication Username', 'authUsername')}>
              <TextInput value={profile.authUsername} onChangeText={(authUsername) => update({ authUsername })} style={inputStyle} autoCapitalize="none" />
            </SipFieldRow>
            <SipPasswordField
              label="Password"
              value={profile.password}
              onChangeText={(password) => update({ password })}
              onTooltipPress={() => showTooltip('Password', 'password')}
              error={errors.password}
            />
          </SipSectionCard>
        ) : null}

        {visible.server ? (
          <SipSectionCard title="Server">
            <SipFieldRow label="SIP Server" error={errors.sipServer} onTooltipPress={() => showTooltip('SIP Server', 'sipServer')}>
              <TextInput value={profile.sipServer} onChangeText={(sipServer) => update({ sipServer })} style={[inputStyle, errors.sipServer && { borderColor: colors.error }]} autoCapitalize="none" />
            </SipFieldRow>
            <SipFieldRow label="SIP Port" error={errors.sipPort} onTooltipPress={() => showTooltip('SIP Port', 'sipPort')}>
              <TextInput value={profile.sipPort} onChangeText={(sipPort) => update({ sipPort })} style={[inputStyle, errors.sipPort && { borderColor: colors.error }]} keyboardType="number-pad" />
            </SipFieldRow>
            <SipSelectField label="Transport" value={profile.transport} options={TRANSPORT_OPTIONS} onChange={onTransportChange} />
          </SipSectionCard>
        ) : null}

        {visible.network ? (
          <SipSectionCard title="Network">
            <SipFieldRow label="Outbound Proxy" onTooltipPress={() => showTooltip('Outbound Proxy', 'outboundProxy')}>
              <TextInput value={profile.outboundProxy} onChangeText={(outboundProxy) => update({ outboundProxy })} style={inputStyle} autoCapitalize="none" />
            </SipFieldRow>
            <SipFieldRow label="Secondary Proxy (optional)">
              <TextInput value={profile.secondaryProxy} onChangeText={(secondaryProxy) => update({ secondaryProxy })} style={inputStyle} autoCapitalize="none" />
            </SipFieldRow>
            <SipFieldRow label="STUN Server (optional)" error={errors.stunServer} onTooltipPress={() => showTooltip('STUN Server', 'stunServer')}>
              <TextInput value={profile.stunServer} onChangeText={(stunServer) => update({ stunServer })} style={[inputStyle, errors.stunServer && { borderColor: colors.error }]} autoCapitalize="none" />
            </SipFieldRow>
            <SipToggleField label="Keep Alive" value={profile.keepAlive} onChange={(keepAlive) => update({ keepAlive })} />
            <SipFieldRow label="Registration Expiry (seconds)" error={errors.registrationExpirySec}>
              <TextInput value={profile.registrationExpirySec} onChangeText={(registrationExpirySec) => update({ registrationExpirySec })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
          </SipSectionCard>
        ) : null}

        {visible.codecs ? (
          <SipSectionCard title="Preferred Codecs">
            <SipCodecList codecs={profile.codecs} onChange={(codecs) => update({ codecs })} error={errors.codecs} />
          </SipSectionCard>
        ) : null}

        {visible.dtmf ? (
          <SipSectionCard title="DTMF">
            <SipSelectField label="Mode" value={profile.dtmfMode} options={DTMF_OPTIONS} onChange={(dtmfMode) => update({ dtmfMode })} />
          </SipSectionCard>
        ) : null}

        {visible.nat ? (
          <SipSectionCard title="NAT Traversal">
            <SipSelectField label="Mode" value={profile.natTraversal} options={NAT_OPTIONS} onChange={(natTraversal) => update({ natTraversal })} />
          </SipSectionCard>
        ) : null}

        {visible.security ? (
          <SipSectionCard title="Security">
            <SipSelectField label="SRTP" value={profile.srtp} options={SRTP_OPTIONS} onChange={(srtp) => update({ srtp })} error={errors.srtp} />
            <SipSelectField label="TLS Version" value={profile.tlsVersion} options={TLS_OPTIONS} onChange={(tlsVersion) => update({ tlsVersion })} />
            <SipToggleField label="Verify Server Certificate" value={profile.verifyServerCertificate} onChange={(verifyServerCertificate) => update({ verifyServerCertificate })} />
          </SipSectionCard>
        ) : null}

        {visible.audio ? (
          <SipSectionCard title="Audio">
            <SipToggleField label="Echo Cancellation" value={profile.echoCancellation} onChange={(echoCancellation) => update({ echoCancellation })} />
            <SipToggleField label="Noise Suppression" value={profile.noiseSuppression} onChange={(noiseSuppression) => update({ noiseSuppression })} />
            <SipToggleField label="Automatic Gain Control" value={profile.automaticGainControl} onChange={(automaticGainControl) => update({ automaticGainControl })} />
            <SipToggleField label="Voice Activity Detection" value={profile.voiceActivityDetection} onChange={(voiceActivityDetection) => update({ voiceActivityDetection })} />
            <SipToggleField label="Comfort Noise" value={profile.comfortNoise} onChange={(comfortNoise) => update({ comfortNoise })} />
            <SipToggleField label="Adaptive Jitter Buffer" value={profile.adaptiveJitterBuffer} onChange={(adaptiveJitterBuffer) => update({ adaptiveJitterBuffer })} />
          </SipSectionCard>
        ) : null}

        {visible.callFeatures ? (
          <SipSectionCard title="Call Features">
            <SipToggleField label="Auto Answer" value={profile.autoAnswer} onChange={(autoAnswer) => update({ autoAnswer })} />
            <SipToggleField label="Call Waiting" value={profile.callWaiting} onChange={(callWaiting) => update({ callWaiting })} />
            <SipToggleField label="Do Not Disturb" value={profile.doNotDisturb} onChange={(doNotDisturb) => update({ doNotDisturb })} />
            <SipToggleField label="Auto Record Calls" value={profile.autoRecordCalls} onChange={(autoRecordCalls) => update({ autoRecordCalls })} />
            <SipFieldRow label="Call Recording Path (optional)">
              <TextInput value={profile.callRecordingPath} onChangeText={(callRecordingPath) => update({ callRecordingPath })} style={inputStyle} />
            </SipFieldRow>
          </SipSectionCard>
        ) : null}

        {visible.voicemail ? (
          <SipSectionCard title="Voicemail">
            <SipFieldRow label="Voicemail Number">
              <TextInput value={profile.voicemailNumber} onChangeText={(voicemailNumber) => update({ voicemailNumber })} style={inputStyle} keyboardType="phone-pad" />
            </SipFieldRow>
            <SipFieldRow label="Mailbox ID">
              <TextInput value={profile.mailboxId} onChangeText={(mailboxId) => update({ mailboxId })} style={inputStyle} />
            </SipFieldRow>
          </SipSectionCard>
        ) : null}

        {visible.advanced ? (
          <SipSectionCard title="Advanced" collapsible defaultCollapsed>
            <SipFieldRow label="SIP Session Timer (seconds)">
              <TextInput value={profile.sipSessionTimerSec} onChangeText={(sipSessionTimerSec) => update({ sipSessionTimerSec })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
            <SipSelectField label="Session Refresh" value={profile.sessionRefresh} options={SESSION_REFRESH_OPTIONS} onChange={(sessionRefresh) => update({ sessionRefresh })} />
            <SipToggleField label="DNS SRV Lookup" value={profile.dnsSrvLookup} onChange={(dnsSrvLookup) => update({ dnsSrvLookup })} />
            <SipToggleField label="DNS NAPTR" value={profile.dnsNaptr} onChange={(dnsNaptr) => update({ dnsNaptr })} />
            <SipToggleField label="RPort" value={profile.rport} onChange={(rport) => update({ rport })} />
            <SipToggleField label="Symmetric RTP" value={profile.symmetricRtp} onChange={(symmetricRtp) => update({ symmetricRtp })} />
            <SipToggleField label="Rewrite Contact Header" value={profile.rewriteContactHeader} onChange={(rewriteContactHeader) => update({ rewriteContactHeader })} />
            <SipToggleField label="Use Compact SIP Headers" value={profile.useCompactSipHeaders} onChange={(useCompactSipHeaders) => update({ useCompactSipHeaders })} />
            <SipToggleField label="Enable SIP OPTIONS Keepalive" value={profile.sipOptionsKeepalive} onChange={(sipOptionsKeepalive) => update({ sipOptionsKeepalive })} />
            <SipFieldRow label="Keepalive Interval (sec)">
              <TextInput value={profile.sipOptionsKeepaliveIntervalSec} onChangeText={(sipOptionsKeepaliveIntervalSec) => update({ sipOptionsKeepaliveIntervalSec })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
            <SipFieldRow label="Secondary SIP Server">
              <TextInput value={profile.secondarySipServer} onChangeText={(secondarySipServer) => update({ secondarySipServer })} style={inputStyle} autoCapitalize="none" />
            </SipFieldRow>
            <SipFieldRow label="RTP Port Range Start">
              <TextInput value={profile.rtpPortRangeStart} onChangeText={(rtpPortRangeStart) => update({ rtpPortRangeStart })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
            <SipFieldRow label="RTP Port Range End">
              <TextInput value={profile.rtpPortRangeEnd} onChangeText={(rtpPortRangeEnd) => update({ rtpPortRangeEnd })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
            <SipFieldRow label="Local SIP Port">
              <TextInput value={profile.localSipPort} onChangeText={(localSipPort) => update({ localSipPort })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
            <SipFieldRow label="Local RTP Port">
              <TextInput value={profile.localRtpPort} onChangeText={(localRtpPort) => update({ localRtpPort })} style={inputStyle} keyboardType="number-pad" />
            </SipFieldRow>
            <SipFieldRow label="Caller ID">
              <TextInput value={profile.callerId} onChangeText={(callerId) => update({ callerId })} style={inputStyle} />
            </SipFieldRow>
            <Button label="Export Grandstream format" variant="secondary" onPress={() => void handleExport(true)} />
          </SipSectionCard>
        ) : null}

        {visible.logging ? (
          <SipSectionCard title="Logging" collapsible defaultCollapsed>
            <SipToggleField label="Enable SIP Logs" value={profile.enableSipLogs} onChange={(enableSipLogs) => update({ enableSipLogs })} />
            <SipToggleField label="Enable RTP Logs" value={profile.enableRtpLogs} onChange={(enableRtpLogs) => update({ enableRtpLogs })} />
            <SipSelectField label="Log Level" value={profile.logLevel} options={LOG_LEVEL_OPTIONS} onChange={(logLevel) => update({ logLevel })} />
          </SipSectionCard>
        ) : null}

        <View style={styles.footerActions}>
          <Button label="Test Connection" variant="secondary" loading={testing} onPress={() => void handleTest()} />
          <Button label="Register" variant="secondary" loading={registering} onPress={() => void handleSave(true)} />
          <Button label="Save" loading={saving} onPress={() => void handleSave(false)} />
          <Button label="Save & Register" loading={saving || registering} onPress={() => void handleSave(true)} />
          <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>

      <Modal visible={qrOpen} animationType="slide" onRequestClose={() => setQrOpen(false)}>
        <View style={[styles.qrRoot, { backgroundColor: colors.background }]}>
          <Text style={[styles.qrTitle, { color: colors.text }]}>Scan SIP provisioning QR</Text>
          <Text style={[styles.qrHelp, { color: colors.textMuted }]}>
            Scan a VSP SIP provisioning QR from your administrator to auto-fill account and server settings.
          </Text>
          <View style={[styles.qrCamera, { borderColor: colors.border }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={qrScanned ? undefined : handleQrScan}
            />
          </View>
          <Button label="Close" variant="ghost" onPress={() => setQrOpen(false)} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  banner: {
    ...typography.caption,
    padding: spacing.sm,
    borderRadius: 10,
    overflow: 'hidden',
  },
  quickActions: {
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 48,
  },
  footerActions: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  qrRoot: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  qrTitle: { ...typography.title },
  qrHelp: { ...typography.body },
  qrCamera: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    minHeight: 360,
  },
});
