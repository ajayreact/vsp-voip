/**
 * React Native component test setup — QA only.
 * Import at top of mobile component test files.
 */
import { vi } from 'vitest';

vi.mock('../../mobile-rn/src/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    telemetry: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));
