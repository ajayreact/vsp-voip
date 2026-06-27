const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = 60 * 60;

function getSigningSecret() {
  const secret = process.env.MESSAGING_ATTACHMENT_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return 'test-attachment-secret';
  throw new Error('MESSAGING_ATTACHMENT_SECRET or JWT_SECRET must be configured for MMS attachment access');
}

function buildAttachmentDownloadPath(attachmentId) {
  return `/api/messages/attachments/${attachmentId}/download`;
}

function signAttachmentToken(attachmentId, expiresAt) {
  const payload = `${attachmentId}:${expiresAt}`;
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
}

function verifyAttachmentToken(attachmentId, expiresAt, signature) {
  if (!attachmentId || !expiresAt || !signature) return false;
  const exp = Number(expiresAt);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = signAttachmentToken(attachmentId, exp);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(signature), 'hex'));
  } catch {
    return false;
  }
}

function buildSignedAttachmentUrl(attachmentId, baseUrl, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signAttachmentToken(attachmentId, expiresAt);
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  return `${normalizedBase}${buildAttachmentDownloadPath(attachmentId)}?exp=${expiresAt}&sig=${sig}`;
}

function isSignedAttachmentUrl(publicUrl) {
  if (!publicUrl) return false;
  return publicUrl.includes('/api/messages/attachments/') && publicUrl.includes('/download');
}

function isLegacyPublicAttachmentUrl(publicUrl) {
  if (!publicUrl) return false;
  return publicUrl.includes('/uploads/messaging/');
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  buildAttachmentDownloadPath,
  buildSignedAttachmentUrl,
  verifyAttachmentToken,
  isSignedAttachmentUrl,
  isLegacyPublicAttachmentUrl,
};
