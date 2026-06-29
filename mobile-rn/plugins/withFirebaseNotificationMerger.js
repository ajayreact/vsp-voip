const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const FCM_NOTIFICATION_COLOR = 'com.google.firebase.messaging.default_notification_color';
const NOTIFICATION_COLOR_RESOURCE = '@color/notification_icon_color';
const NOTIFICATION_COLOR_HEX = '#1976D2';

function ensureArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function withNotificationColorResource(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const valuesDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'values',
      );
      fs.mkdirSync(valuesDir, { recursive: true });
      const colorsPath = path.join(valuesDir, 'colors.xml');
      let contents = fs.existsSync(colorsPath) ? fs.readFileSync(colorsPath, 'utf8') : '<resources>\n</resources>';
      if (!contents.includes('notification_icon_color')) {
        contents = contents.replace(
          '</resources>',
          `  <color name="notification_icon_color">${NOTIFICATION_COLOR_HEX}</color>\n</resources>`,
        );
        fs.writeFileSync(colorsPath, contents);
      }
      return config;
    },
  ]);
}

function withFirebaseNotificationMerger(config) {
  config = withNotificationColorResource(config);
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const manifest = androidManifest.manifest;
    if (!manifest.$) manifest.$ = {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
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
  return config;
}

module.exports = withFirebaseNotificationMerger;
