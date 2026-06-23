const { getCredentialConnection } = require('./telnyxRecordingSetup');

function pickPushField(connection, keys) {
  for (const key of keys) {
    const value = connection?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

/**
 * Inspect Telnyx credential connection for mobile push notification configuration.
 * Telnyx field names vary by API version — check common paths.
 */
async function getCredentialConnectionPushStatus(connectionId) {
  if (!connectionId) {
    return {
      configured: false,
      androidConfigured: false,
      iosConfigured: false,
      message: 'Credential connection is not configured.',
      portalAction: 'Set TELNYX_CREDENTIAL_CONNECTION_ID or configure in Admin → Platform settings.',
    };
  }

  if (!process.env.TELNYX_API_KEY?.trim()) {
    return {
      configured: false,
      androidConfigured: false,
      iosConfigured: false,
      message: 'TELNYX_API_KEY is not set — cannot inspect push configuration.',
    };
  }

  let connection = null;
  try {
    connection = await getCredentialConnection(connectionId);
  } catch (error) {
    return {
      configured: false,
      androidConfigured: false,
      iosConfigured: false,
      message: `Could not load credential connection: ${error.message}`,
    };
  }

  if (!connection) {
    return {
      configured: false,
      androidConfigured: false,
      iosConfigured: false,
      message: 'Credential connection not found in Telnyx.',
    };
  }

  const pushSetting = connection.push_notification_setting
    || connection.push_notification_settings
    || connection.push_credentials
    || connection.push
    || null;

  const androidCredentialId = pickPushField(connection, [
    'android_push_credential_id',
    'android_push_credential',
    'fcm_credential_id',
  ]) || pickPushField(pushSetting, [
    'android_push_credential_id',
    'android',
    'fcm_credential_id',
  ]);

  const iosCredentialId = pickPushField(connection, [
    'ios_push_credential_id',
    'ios_push_credential',
    'apns_credential_id',
  ]) || pickPushField(pushSetting, [
    'ios_push_credential_id',
    'ios',
    'apns_credential_id',
  ]);

  const pushEnabled = Boolean(
    pushSetting?.enabled
    || pushSetting?.push_enabled
    || connection.push_notification_enabled,
  );

  const androidConfigured = Boolean(androidCredentialId);
  const iosConfigured = Boolean(iosCredentialId);
  const configured = Boolean(pushEnabled || androidConfigured || iosConfigured);

  let message = 'Push notifications appear configured on the Telnyx credential connection.';
  let portalAction = null;

  if (!configured) {
    message = 'Push notifications are not configured on the Telnyx credential connection (VSP-SIP-Trunk). Background mobile inbound will not ring.';
    portalAction = 'Telnyx Portal → VSP-SIP-Trunk → Push notifications → upload FCM (Android) and VoIP APNs (iOS) credentials matching your mobile app Firebase/Apple setup.';
  } else if (!androidConfigured) {
    message = 'iOS push may be configured but Android FCM is missing on the credential connection.';
    portalAction = 'Telnyx Portal → VSP-SIP-Trunk → Push → add Firebase/FCM credentials for project vsp-viop (com.vspvoip.mobile).';
  } else if (!iosConfigured) {
    message = 'Android FCM may be configured but iOS VoIP APNs is missing on the credential connection.';
    portalAction = 'Telnyx Portal → VSP-SIP-Trunk → Push → add VoIP APNs certificate/key for com.vspvoip.mobile.';
  }

  return {
    configured,
    pushEnabled,
    androidConfigured,
    iosConfigured,
    androidCredentialId: androidCredentialId || null,
    iosCredentialId: iosCredentialId || null,
    connectionName: connection.connection_name || connection.name || null,
    message,
    portalAction,
    note: 'Mobile SDK must also pass notificationToken on connectWithToken; this checks Telnyx Portal push credentials only.',
  };
}

module.exports = {
  getCredentialConnectionPushStatus,
};
