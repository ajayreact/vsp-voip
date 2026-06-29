import fs from 'fs';
import path from 'path';
import type { ExpoConfig } from 'expo/config';

const buildProfile = process.env.EAS_BUILD_PROFILE || '';
const isEasBuild = process.env.EAS_BUILD === 'true';
const isProductionBuild =
  isEasBuild && buildProfile === 'production'
  || process.env.NODE_ENV === 'production';
const isReleaseEasBuild = isEasBuild && (buildProfile === 'production' || buildProfile === 'preview');
const isAndroidEasBuild = isEasBuild && process.env.EAS_BUILD_PLATFORM === 'android';

if (isReleaseEasBuild && !process.env.EXPO_PUBLIC_API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL is required for preview and production EAS builds');
}

const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

if (isAndroidEasBuild && isReleaseEasBuild) {
  if (!googleServicesFile) {
    throw new Error('GOOGLE_SERVICES_JSON is required for Android preview and production EAS builds');
  }
  const resolvedGoogleServices = path.isAbsolute(googleServicesFile)
    ? googleServicesFile
    : path.resolve(__dirname, googleServicesFile);
  if (!fs.existsSync(resolvedGoogleServices)) {
    throw new Error(`GOOGLE_SERVICES_JSON file not found: ${resolvedGoogleServices}`);
  }
}

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
const apsEnvironment = process.env.APNS_ENVIRONMENT
  || (isProductionBuild ? 'production' : 'development');

const plugins: ExpoConfig['plugins'] = [
  ...(buildProfile === 'development' || (!isEasBuild && process.env.NODE_ENV !== 'production')
    ? ['expo-dev-client' as const]
    : []),
  [
    '@config-plugins/react-native-webrtc',
    {
      microphonePermission: 'VSP Phone uses the microphone for voice calls.',
    },
  ],
  [
    'expo-notifications',
    {
      icon: './assets/icon.png',
      color: '#1976D2',
      sounds: [],
    },
  ],
  [
    'expo-splash-screen',
    {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F7F8FA',
    },
  ],
  [
    'expo-local-authentication',
    {
      faceIDPermission: 'Allow VSP Phone to use Face ID for quick sign-in.',
    },
  ],
  [
    'expo-image-picker',
    {
      photosPermission: 'VSP Phone accesses photos to attach images to text messages.',
    },
  ],
  '@react-native-firebase/app',
  [
    'expo-camera',
    {
      cameraPermission: 'VSP Phone uses the camera to scan organization login QR codes.',
    },
  ],
  './plugins/withTelnyxVoice.js',
  './plugins/withFirebaseNotificationMerger.js',
];

const config: ExpoConfig = {
  name: 'VSP Phone',
  slug: 'vsp-phone',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'vspphone',
  plugins,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.vspphone.mobile',
    infoPlist: {
      NSMicrophoneUsageDescription: 'VSP Phone uses the microphone for voice calls.',
      UIBackgroundModes: ['audio', 'voip', 'remote-notification'],
    },
    entitlements: {
      'aps-environment': apsEnvironment,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0f172a',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    package: 'com.vspphone.mobile',
    predictiveBackGestureEnabled: false,
    permissions: [
      'RECORD_AUDIO',
      'MODIFY_AUDIO_SETTINGS',
      'BLUETOOTH',
      'BLUETOOTH_CONNECT',
      'POST_NOTIFICATIONS',
      'WAKE_LOCK',
      'VIBRATE',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_PHONE_CALL',
      'FOREGROUND_SERVICE_MICROPHONE',
      'USE_FULL_SCREEN_INTENT',
    ],
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    apiBaseUrl,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '9e4788a7-6806-4b1b-9f1a-c25b6abfe6fd',
    },
  },
};

export default config;
