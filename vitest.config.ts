import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: 'true',
  },
  resolve: {
    dedupe: ['react', 'react-test-renderer'],
    alias: {
      '@': path.resolve(__dirname, 'web/src'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'tests/mobile/stubs/react-native.tsx'),
      'react-native-reanimated': path.resolve(
        __dirname,
        'tests/mobile/stubs/react-native-reanimated.ts',
      ),
      'react-native-worklets': path.resolve(
        __dirname,
        'tests/mobile/stubs/react-native-worklets.ts',
      ),
      [path.resolve(__dirname, 'mobile-rn/src/shared/theme/ThemeContext.tsx')]: path.resolve(
        __dirname,
        'tests/mobile/stubs/theme.ts',
      ),
      [path.resolve(__dirname, 'mobile-rn/src/shared/theme/index.ts')]: path.resolve(
        __dirname,
        'tests/mobile/stubs/theme.ts',
      ),
      '@expo-google-fonts/inter': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-google-fonts-inter.ts',
      ),
      'expo-modules-core': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-modules-core.ts',
      ),
      'expo-secure-store': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-secure-store.ts',
      ),
      'expo-local-authentication': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-local-authentication.ts',
      ),
      'expo-clipboard': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-clipboard.ts',
      ),
      'expo-haptics': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-haptics.ts',
      ),
      'expo-av': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-av.ts',
      ),
      'expo-file-system': path.resolve(
        __dirname,
        'tests/mobile/stubs/expo-file-system.ts',
      ),
      '@react-native-async-storage/async-storage': path.resolve(
        __dirname,
        'tests/mobile/stubs/async-storage.ts',
      ),
      '@tanstack/react-query': path.resolve(
        __dirname,
        'mobile-rn/node_modules/@tanstack/react-query',
      ),
      [path.resolve(__dirname, 'mobile-rn/src/components/Button.tsx')]: path.resolve(
        __dirname,
        'tests/mobile/stubs/Button.tsx',
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    reporters: ['default', 'json'],
    outputFile: { json: './reports/vitest-results.json' },
    passWithNoTests: false,
  },
});
