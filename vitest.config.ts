import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    reporters: ['default', 'json'],
    outputFile: { json: './reports/vitest-results.json' },
    passWithNoTests: false,
  },
});
