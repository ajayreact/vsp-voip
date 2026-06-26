const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const {
  MAX_ATTACHMENT_BYTES,
  MAX_MMS_ATTACHMENTS,
  INBOUND_MEDIA_DOWNLOAD_MAX_RETRIES,
  INBOUND_MEDIA_DOWNLOAD_RETRY_MS,
} = require('./constants');
const { mapAttachmentRecord } = require('./mappers');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'messaging');

const OUTBOUND_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'application/pdf',
  'text/plain',
]);

const INBOUND_ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];
const INBOUND_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
]);

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getApiPublicBase() {
  return (process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

function buildPublicUrl(storageKey) {
  return `${getApiPublicBase()}/uploads/messaging/${storageKey}`;
}

function sanitizeFileName(filename) {
  return String(filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function inferMimeType(filename, mimeType) {
  const normalized = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (normalized) return normalized;

  const ext = path.extname(String(filename || '')).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function extensionForMimeType(mimeType) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
  };
  return map[mimeType] || '';
}

function isInboundMimeAllowed(mimeType) {
  const normalized = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (!normalized) return false;
  if (INBOUND_ALLOWED_MIME_TYPES.has(normalized)) return true;
  return INBOUND_ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadMediaBuffer(url) {
  let lastError;
  for (let attempt = 1; attempt <= INBOUND_MEDIA_DOWNLOAD_MAX_RETRIES; attempt += 1) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: MAX_ATTACHMENT_BYTES,
        maxBodyLength: MAX_ATTACHMENT_BYTES,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || null,
      };
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const retryable = !status || status === 429 || status >= 500;
      if (attempt >= INBOUND_MEDIA_DOWNLOAD_MAX_RETRIES || !retryable) {
        break;
      }
      await sleep(INBOUND_MEDIA_DOWNLOAD_RETRY_MS * attempt);
    }
  }

  const detail = lastError?.response?.status
    ? `HTTP ${lastError.response.status}`
    : lastError?.message || 'download failed';
  throw new Error(`Inbound MMS download failed: ${detail}`);
}

async function persistInboundAttachment({
  tenantId,
  telnyxMessageId,
  messageId,
  index,
  item,
}) {
  if (!item?.url) {
    throw new Error('Inbound media item is missing url');
  }

  const { buffer, contentType } = await downloadMediaBuffer(item.url);
  if (!buffer.length) {
    throw new Error('Inbound MMS download returned empty content');
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(`Inbound MMS attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes`);
  }

  const safeName = sanitizeFileName(item.fileName);
  const resolvedMime = inferMimeType(safeName, item.contentType || contentType);
  if (!isInboundMimeAllowed(resolvedMime)) {
    throw new Error(`Unsupported inbound MMS type: ${resolvedMime}`);
  }

  ensureUploadsDir();
  const ext = path.extname(safeName) || extensionForMimeType(resolvedMime) || '.bin';
  const storageKey = `${tenantId}-in-${telnyxMessageId || messageId}-${index}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, storageKey), buffer);

  return {
    tenantId,
    storageKey,
    publicUrl: buildPublicUrl(storageKey),
    mimeType: resolvedMime,
    sizeBytes: buffer.length,
    fileName: safeName || `media-${index + 1}${ext}`,
  };
}

async function persistInboundAttachments({
  tenantId,
  telnyxMessageId,
  messageId,
  mediaItems,
}) {
  if (!Array.isArray(mediaItems) || !mediaItems.length) return [];

  if (mediaItems.length > MAX_MMS_ATTACHMENTS) {
    throw new Error(`Maximum ${MAX_MMS_ATTACHMENTS} inbound attachments per message`);
  }

  const rows = [];
  for (let index = 0; index < mediaItems.length; index += 1) {
    const row = await persistInboundAttachment({
      tenantId,
      telnyxMessageId,
      messageId,
      index,
      item: mediaItems[index],
    });
    rows.push(row);
  }
  return rows;
}

function isDurablePublicUrl(publicUrl) {
  if (!publicUrl) return false;
  const base = getApiPublicBase();
  return publicUrl.startsWith(`${base}/uploads/messaging/`);
}

async function uploadAttachment(prisma, tenantId, { data, filename, mimeType }) {
  if (!data || !filename) {
    throw Object.assign(new Error('data and filename are required'), { status: 400 });
  }

  const safeName = sanitizeFileName(filename);
  const base64 = String(data).includes(',') ? String(data).split(',')[1] : String(data);
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    throw Object.assign(new Error('Attachment data is empty'), { status: 400 });
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw Object.assign(new Error('Attachment must be 5 MB or smaller'), { status: 400 });
  }

  const resolvedMime = inferMimeType(safeName, mimeType);
  if (!OUTBOUND_ALLOWED_MIME_TYPES.has(resolvedMime)) {
    throw Object.assign(new Error('Unsupported attachment type'), { status: 400 });
  }

  ensureUploadsDir();
  const storageKey = `${tenantId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeName}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, storageKey), buffer);

  const attachment = await prisma.messageAttachment.create({
    data: {
      tenantId,
      storageKey,
      publicUrl: buildPublicUrl(storageKey),
      mimeType: resolvedMime,
      sizeBytes: buffer.length,
      fileName: safeName,
    },
  });

  return mapAttachmentRecord(attachment);
}

async function loadAttachmentsForSend(prisma, tenantId, attachmentIds) {
  if (!Array.isArray(attachmentIds) || !attachmentIds.length) return [];

  if (attachmentIds.length > MAX_MMS_ATTACHMENTS) {
    throw Object.assign(new Error(`Maximum ${MAX_MMS_ATTACHMENTS} attachments per message`), { status: 400 });
  }

  const attachments = await prisma.messageAttachment.findMany({
    where: {
      id: { in: attachmentIds },
      tenantId,
      messageId: null,
    },
  });

  if (attachments.length !== attachmentIds.length) {
    throw Object.assign(new Error('One or more attachments were not found or already linked'), { status: 400 });
  }

  return attachments;
}

async function linkAttachmentsToMessage(prisma, attachmentIds, messageId) {
  if (!attachmentIds?.length) return;
  await prisma.messageAttachment.updateMany({
    where: { id: { in: attachmentIds } },
    data: { messageId },
  });
}

module.exports = {
  UPLOADS_DIR,
  OUTBOUND_ALLOWED_MIME_TYPES,
  ensureUploadsDir,
  buildPublicUrl,
  isDurablePublicUrl,
  inferMimeType,
  isInboundMimeAllowed,
  persistInboundAttachment,
  persistInboundAttachments,
  uploadAttachment,
  loadAttachmentsForSend,
  linkAttachmentsToMessage,
};
