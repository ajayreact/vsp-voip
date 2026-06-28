import Constants from 'expo-constants';

type ExtraConfig = {
  apiBaseUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

export const env = {
  apiBaseUrl: (extra.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
};
