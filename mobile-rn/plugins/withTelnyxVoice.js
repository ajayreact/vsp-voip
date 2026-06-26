const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainActivity,
  withAppDelegate,
  withInfoPlist,
  withDangerousMod,
  withXcodeProject,
  IOSConfig,
  AndroidConfig,
} = require('expo/config-plugins');

const PACKAGE = 'com.vspphone.mobile';

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function withTelnyxIos(config) {
  config = withInfoPlist(config, (config) => {
    const modes = new Set(ensureArray(config.modResults.UIBackgroundModes));
    modes.add('audio');
    modes.add('voip');
    modes.add('remote-notification');
    config.modResults.UIBackgroundModes = Array.from(modes);
    return config;
  });

  config = withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('TelnyxVoipPushHandler')) {
      if (!contents.includes('import PushKit')) {
        contents = contents.replace(
          /import ExpoModulesCore/,
          'import PushKit\nimport TelnyxVoiceCommons\nimport ExpoModulesCore',
        );
      }
      if (contents.includes('didFinishLaunchingWithOptions')) {
        contents = contents.replace(
          /return super\.application\(application, didFinishLaunchingWithOptions: launchOptions\)/,
          `TelnyxVoipPushHandler.initializeVoipRegistration()\n    return super.application(application, didFinishLaunchingWithOptions: launchOptions)`,
        );
      }
      if (!contents.includes('PKPushRegistryDelegate')) {
        contents += `

// MARK: - Telnyx VoIP Push (CallKit handled by SDK CallBridge)
extension AppDelegate: PKPushRegistryDelegate {
  public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    let token = pushCredentials.token.map { String(format: "%02.2hhx", $0) }.joined()
    UserDefaults.standard.set(token, forKey: "vsp.voipPushToken")
    TelnyxVoipPushHandler.shared.handleVoipTokenUpdate(pushCredentials, type: type)
  }

  public func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    TelnyxVoipPushHandler.shared.handleVoipPush(payload, type: type, completion: completion)
  }
}
`;
      }
    }
    config.modResults.contents = contents;
    return config;
  });

  return config;
}

function withTelnyxAndroidManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const manifest = androidManifest.manifest;
    if (!manifest.$) manifest.$ = {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      'com.google.firebase.messaging.default_notification_channel_id',
      'vsp_calls',
      'value',
    );

    if (!app.service) app.service = [];
    const services = ensureArray(app.service);
    const receivers = ensureArray(app.receiver);

    if (!services.some((item) => item.$?.['android:name'] === '.VspFirebaseMessagingService')) {
      services.push({
        $: {
          'android:name': '.VspFirebaseMessagingService',
          'android:exported': 'false',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }],
          },
        ],
      });
    }

    if (!receivers.some((item) => item.$?.['android:name'] === '.VspNotificationActionReceiver')) {
      receivers.push({
        $: {
          'android:name': '.VspNotificationActionReceiver',
          'android:exported': 'false',
        },
      });
    }

    app.service = services;
    app.receiver = receivers;
    return config;
  });
}

function withTelnyxMainActivity(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('TelnyxMainActivity')) {
      contents = contents.replace(
        /import com\.facebook\.react\.ReactActivity/,
        'import com.telnyx.react_voice_commons.TelnyxMainActivity',
      );
      contents = contents.replace(
        /class MainActivity : ReactActivity\(\)/,
        'class MainActivity : TelnyxMainActivity()',
      );
    }
    config.modResults.contents = contents;
    return config;
  });
}

function withTelnyxNativeSources(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const packagePath = PACKAGE.split('.').join(path.sep);
      const targetDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        packagePath,
      );
      fs.mkdirSync(targetDir, { recursive: true });

      const templateDir = path.join(projectRoot, 'plugins', 'android');
      for (const file of ['VspFirebaseMessagingService.kt', 'VspNotificationActionReceiver.kt']) {
        fs.copyFileSync(path.join(templateDir, file), path.join(targetDir, file));
      }

      const googleServices = process.env.GOOGLE_SERVICES_JSON
        ? path.resolve(projectRoot, process.env.GOOGLE_SERVICES_JSON)
        : path.join(projectRoot, 'google-services.json');
      const dest = path.join(config.modRequest.platformProjectRoot, 'app', 'google-services.json');
      if (fs.existsSync(googleServices)) {
        fs.copyFileSync(googleServices, dest);
      }

      return config;
    },
  ]);
}

function withTelnyxIosNativeSources(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName || 'VSPPhone';
      const targetDir = path.join(config.modRequest.platformProjectRoot, projectName);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(
        path.join(projectRoot, 'plugins', 'ios', 'VoicePnBridge.m'),
        path.join(targetDir, 'VoicePnBridge.m'),
      );
      return config;
    },
  ]);
}

function withVoicePnBridgeXcodeProject(config) {
  return withXcodeProject(config, (config) => {
    const projectName = config.modRequest.projectName;
    const filePath = `${projectName}/VoicePnBridge.m`;

    if (!config.modResults.hasFile(filePath)) {
      config.modResults = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: filePath,
        groupName: projectName,
        project: config.modResults,
        verbose: false,
      });
    }

    return config;
  });
}

function withTelnyxVoice(config) {
  config = withTelnyxIos(config);
  config = withTelnyxIosNativeSources(config);
  config = withVoicePnBridgeXcodeProject(config);
  config = withTelnyxAndroidManifest(config);
  config = withTelnyxMainActivity(config);
  config = withTelnyxNativeSources(config);
  return config;
}

module.exports = withTelnyxVoice;
