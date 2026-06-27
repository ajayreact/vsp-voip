import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const {
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokensForUser,
} = require('../../lib/refreshTokens');
const { signToken } = require('../../lib/auth');

describe('auth logout refresh revocation', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('revokes all refresh tokens for the authenticated user', async () => {
    const userId = 'logout-user-1';
    const refreshToken = await issueRefreshToken(userId);
    const accessToken = signToken({
      sub: userId,
      email: 'logout@example.com',
      name: 'Logout User',
      role: 'TENANT_USER',
      tenantId: 'tenant-1',
    });

    await revokeAllRefreshTokensForUser(userId);

    expect(accessToken).toBeTruthy();
    expect(await rotateRefreshToken(refreshToken)).toBeNull();
  });
});
