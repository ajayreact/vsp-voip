const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');

const FCM_NOTIFICATION_COLOR = 'com.google.firebase.messaging.default_notification_color';
const NOTIFICATION_COLOR_RESOURCE = '@color/notification_icon_color';

function ensureArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function withFirebaseNotificationMerger(config) {
  config = withAndroidManifest(config, (config) => {
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

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'AndroidManifest.xml',
      );
      if (!fs.existsSync(manifestPath)) return config;

      let contents = fs.readFileSync(manifestPath, 'utf8');
      const manifestOpenTag =
        /<manifest\b([^>]*xmlns:tools="http:\/\/schemas\.android\.com\/tools")([^>]*)>/;
      if (manifestOpenTag.test(contents) && !contents.includes('tools:replace="android:package"')) {
        contents = contents.replace(
          manifestOpenTag,
          '<manifest$1$2 tools:replace="android:package">',
        );
        fs.writeFileSync(manifestPath, contents);
      }

      return config;
    },
  ]);

  return config;
}

module.exports = withFirebaseNotificationMerger;
