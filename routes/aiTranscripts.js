const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware } = require('../lib/auth');
const { assertTenantActive } = require('../lib/tenantGuard');
const {
  getEntityTranscript,
  requestTranscription,
} = require('../lib/ai/transcription');

const router = express.Router();

function resolveTenantId(req) {
  if (req.user.role === 'SUPER_ADMIN' && req.query.tenantId) {
    return String(req.query.tenantId);
  }
  return req.user.tenantId;
}

function mapTranscriptionError(error, res) {
  const status = error.status || 500;
  return res.status(status).json({
    error: error.message || 'Transcription request failed',
    code: error.code || 'AI_TRANSCRIPTION_ERROR',
    details: error.details || null,
  });
}

async function withTenantContext(req, res, handler) {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }
    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);
    return handler(prisma, tenantId);
  } catch (error) {
    return mapTranscriptionError(error, res);
  }
}

router.get('/ai/transcripts/voicemail/:id', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await getEntityTranscript(prisma, tenantId, 'voicemail', req.params.id);
    res.json({ success: true, ...result });
  }),
);

router.post('/ai/transcripts/voicemail/:id/generate', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await requestTranscription(prisma, {
      tenantId,
      entityType: 'voicemail',
      entityId: req.params.id,
      userId: req.user.id,
      tenantName: req.body?.tenantName,
      async: req.body?.async !== false,
    });
    res.status(result.queued ? 202 : 200).json({ success: true, ...result });
  }),
);

router.get('/ai/transcripts/call/:id', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await getEntityTranscript(prisma, tenantId, 'call', req.params.id);
    res.json({ success: true, ...result });
  }),
);

router.post('/ai/transcripts/call/:id/generate', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await requestTranscription(prisma, {
      tenantId,
      entityType: 'call',
      entityId: req.params.id,
      userId: req.user.id,
      tenantName: req.body?.tenantName,
      async: req.body?.async !== false,
    });
    res.status(result.queued ? 202 : 200).json({ success: true, ...result });
  }),
);

module.exports = router;
