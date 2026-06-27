import { describe, it, expect } from 'vitest';

const { verifyToken } = require('../../lib/auth');

describe('JWT payload parsing', () => {
  it('returns null for malformed payloads instead of throwing', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from('not-json').toString('base64url');
    const signature = 'abc';
    const token = `${header}.${body}.${signature}`;
    expect(verifyToken(token)).toBeNull();
  });
});
