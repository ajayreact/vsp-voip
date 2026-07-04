import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const {
  buildSignedAttachmentUrl,
  verifyAttachmentToken,
  isSignedAttachmentUrl,
} = require('../../lib/messaging/attachmentAccess');

describe('MMS attachment signed access', () => {
  const originalSecret = process.env.MESSAGING_ATTACHMENT_SECRET;

  beforeEach(() => {
    process.env.MESSAGING_ATTACHMENT_SECRET = 'test-attachment-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.MESSAGING_ATTACHMENT_SECRET;
    } else {
      process.env.MESSAGING_ATTACHMENT_SECRET = originalSecret;
    }
  });

  it('builds and verifies signed download URLs', () => {
    const url = buildSignedAttachmentUrl('att-123', 'https://api.example.com', 3600);
    expect(isSignedAttachmentUrl(url)).toBe(true);

    const parsed = new URL(url);
    const exp = parsed.searchParams.get('exp');
    const sig = parsed.searchParams.get('sig');
    expect(verifyAttachmentToken('att-123', exp, sig)).toBe(true);
    expect(verifyAttachmentToken('att-other', exp, sig)).toBe(false);
  });

  it('rejects expired signatures', () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 60;
    const crypto = require('crypto');
    const sig = crypto
      .createHmac('sha256', 'test-attachment-secret')
      .update(`att-123:${expiredAt}`)
      .digest('hex');
    expect(verifyAttachmentToken('att-123', String(expiredAt), sig)).toBe(false);
  });
});
