import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-test-renderer'],
    alias: {
      '@': path.resolve(__dirname, 'web/src'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'tests/mobile/stubs/react-native.tsx'),
      [path.resolve(__dirname, 'mobile-rn/src/shared/theme/ThemeContext.tsx')]: path.resolve(
        __dirname,
        'tests/mobile/stubs/theme.ts',
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
