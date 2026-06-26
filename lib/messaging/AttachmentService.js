const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MAX_ATTACHMENT_BYTES, MAX_MMS_ATTACHMENTS } = require('./constants');
const { mapAttachmentRecord } = require('./mappers');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'messaging');

const ALLOWED_MIME_TYPES = new Set([
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

function inferMimeType(filename, mimeType) {
  if (mimeType) return mimeType;
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

async function uploadAttachment(prisma, tenantId, { data, filename, mimeType }) {
  if (!data || !filename) {
    throw Object.assign(new Error('data and filename are required'), { status: 400 });
  }

  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const base64 = String(data).includes(',') ? String(data).split(',')[1] : String(data);
  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    throw Object.assign(new Error('Attachment data is empty'), { status: 400 });
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw Object.assign(new Error('Attachment must be 5 MB or smaller'), { status: 400 });
  }

  const resolvedMime = inferMimeType(safeName, mimeType);
  if (!ALLOWED_MIME_TYPES.has(resolvedMime)) {
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
  ensureUploadsDir,
  buildPublicUrl,
  uploadAttachment,
  loadAttachmentsForSend,
  linkAttachmentsToMessage,
};
