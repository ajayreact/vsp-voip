const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('./AttachmentService');
const { verifyAttachmentToken } = require('./attachmentAccess');

function resolveAttachmentFilePath(storageKey) {
  const normalized = path.basename(String(storageKey || ''));
  if (!normalized || normalized !== storageKey) {
    throw Object.assign(new Error('Invalid attachment storage key'), { status: 400 });
  }
  const filePath = path.join(UPLOADS_DIR, normalized);
  if (!filePath.startsWith(UPLOADS_DIR)) {
    throw Object.assign(new Error('Invalid attachment path'), { status: 400 });
  }
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error('Attachment file not found'), { status: 404 });
  }
  return filePath;
}

function authorizeAttachmentDownload(req, attachment) {
  if (req.user?.tenantId && req.user.tenantId === attachment.tenantId) {
    return true;
  }

  const exp = req.query?.exp;
  const sig = req.query?.sig;
  return verifyAttachmentToken(attachment.id, exp, sig);
}

function sendAttachmentFile(res, attachment) {
  const filePath = resolveAttachmentFilePath(attachment.storageKey);
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  if (attachment.fileName) {
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName.replace(/"/g, '')}"`);
  }
  res.setHeader('Cache-Control', 'private, max-age=300');
  fs.createReadStream(filePath).pipe(res);
}

module.exports = {
  authorizeAttachmentDownload,
  sendAttachmentFile,
};
