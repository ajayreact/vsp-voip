import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
} = require('../../lib/refreshTokens');

describe('refresh token rotation', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('issues and rotates refresh tokens', async () => {
    const first = await issueRefreshToken('user-1');
    const rotated = await rotateRefreshToken(first);
    expect(rotated?.userId).toBe('user-1');
    expect(rotated?.refreshToken).toBeTruthy();
    expect(rotated?.refreshToken).not.toBe(first);

    const reused = await rotateRefreshToken(first);
    expect(reused).toBeNull();
  });

  it('revokes all refresh tokens for a user', async () => {
    const first = await issueRefreshToken('user-logout');
    const second = await issueRefreshToken('user-logout');
    await revokeAllRefreshTokensForUser('user-logout');
    expect(await rotateRefreshToken(first)).toBeNull();
    expect(await rotateRefreshToken(second)).toBeNull();
  });
});
