import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../mobile-rn/src/lib/logger';

describe('withRetry', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('push token preview', () => {
  it('masks long tokens', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz';
    const preview =
      token.length <= 12 ? token : `${token.slice(0, 6)}…${token.slice(-4)}`;
    expect(preview).toBe('abcdef…wxyz');
  });
});
