import type { ExpoConfig } from 'expo/config';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

const config: ExpoConfig = {
  name: 'VSP Phone',
  slug: 'vsp-phone',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.vspphone.mobile',
    infoPlist: {
      NSMicrophoneUsageDescription: 'VSP Phone uses the microphone for voice calls.',
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
    permissions: ['RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    apiBaseUrl,
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined,
    },
  },
};

export default config;
