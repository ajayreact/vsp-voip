import { describe, it, expect } from 'vitest';
import { normalizeDestination } from '../../mobile-rn/src/calling/dialNormalization';

describe('mobile telnyxCallMapping', () => {
  it('normalizes 10-digit US numbers to E.164', () => {
    expect(normalizeDestination('5551234567')).toBe('+15551234567');
  });

  it('preserves extensions', () => {
    expect(normalizeDestination('1002')).toBe('1002');
  });

  it('strips formatting from pasted numbers', () => {
    expect(normalizeDestination('(555) 123-4567')).toBe('+15551234567');
  });

  it('returns empty for invalid input', () => {
    expect(normalizeDestination('')).toBe('');
    expect(normalizeDestination('abc')).toBe('');
  });
});
