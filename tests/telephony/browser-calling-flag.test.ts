import { describe, expect, it } from 'vitest';
import { isBrowserCallingEnabled } from '@/lib/softphone-config';

describe('Phase 2 / browser calling flag', () => {
  it('defaults browser calling to disabled (admin portal only)', () => {
    const previous = process.env.NEXT_PUBLIC_BROWSER_CALLING_ENABLED;
    delete process.env.NEXT_PUBLIC_BROWSER_CALLING_ENABLED;
    expect(isBrowserCallingEnabled()).toBe(false);
    if (previous !== undefined) {
      process.env.NEXT_PUBLIC_BROWSER_CALLING_ENABLED = previous;
    }
  });

  it('honors explicit NEXT_PUBLIC_BROWSER_CALLING_ENABLED=true rollback', () => {
    const previous = process.env.NEXT_PUBLIC_BROWSER_CALLING_ENABLED;
    process.env.NEXT_PUBLIC_BROWSER_CALLING_ENABLED = 'true';
    expect(isBrowserCallingEnabled()).toBe(true);
    if (previous !== undefined) {
      process.env.NEXT_PUBLIC_BROWSER_CALLING_ENABLED = previous;
    } else {
      delete process.env.NEXT_PUBLIC_BROWSER_CALLING_ENABLED;
    }
  });
});
