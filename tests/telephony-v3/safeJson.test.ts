import { describe, expect, it } from 'vitest';

const { safeJsonParse } = require('../../lib/telephony-v3/Utils/safeJson');

describe('V3 safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('returns null for invalid JSON', () => {
    expect(safeJsonParse('{bad')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(safeJsonParse('')).toBeNull();
    expect(safeJsonParse(null)).toBeNull();
  });
});
