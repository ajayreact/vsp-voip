const {
  withAndroidManifest,
  AndroidConfig,
} = require('expo/config-plugins');

const FCM_NOTIFICATION_COLOR = 'com.google.firebase.messaging.default_notification_color';
const NOTIFICATION_COLOR_RESOURCE = '@color/notification_icon_color';

function ensureArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function mergeToolsReplace(existing, attribute) {
  const values = new Set(
    String(existing || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  values.add(attribute);
  return Array.from(values).join(',');
}

function withFirebaseNotificationMerger(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    if (!manifest.$) manifest.$ = {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const androidPackage = config.android?.package;
    if (androidPackage) {
      manifest.$['android:package'] = androidPackage;
      manifest.$['tools:replace'] = mergeToolsReplace(manifest.$['tools:replace'], 'android:package');
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(app, FCM_NOTIFICATION_COLOR);

    const metaData = ensureArray(app['meta-data']);
    metaData.push({
      $: {
        'android:name': FCM_NOTIFICATION_COLOR,
        'android:resource': NOTIFICATION_COLOR_RESOURCE,
        'tools:replace': 'android:resource',
      },
    });
    app['meta-data'] = metaData;

    return config;
  });
}

module.exports = withFirebaseNotificationMerger;
