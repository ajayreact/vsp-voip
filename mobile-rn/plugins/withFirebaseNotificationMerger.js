const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const FCM_NOTIFICATION_COLOR = 'com.google.firebase.messaging.default_notification_color';
const NOTIFICATION_COLOR_RESOURCE = '@color/notification_icon_color';

function ensureArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function withFirebaseNotificationMerger(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    if (!manifest.$) manifest.$ = {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

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
