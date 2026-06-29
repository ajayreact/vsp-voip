const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware } = require('../lib/auth');
const { assertTenantActive } = require('../lib/tenantGuard');
const {
  getVoicemailSummary,
  requestVoicemailSummary,
} = require('../lib/ai/modules/voicemailSummary');
const {
  getCallSummary,
  requestCallSummary,
} = require('../lib/ai/modules/callSummary');
const {
  getMessageSummary,
  requestMessageSummary,
} = require('../lib/ai/modules/messageSummary');

const router = express.Router();

function resolveTenantId(req) {
  if (req.user.role === 'SUPER_ADMIN' && req.query.tenantId) {
    return String(req.query.tenantId);
  }
  return req.user.tenantId;
}

function mapAiError(error, res) {
  const status = error.status || 500;
  return res.status(status).json({
    error: error.message || 'AI summary request failed',
    code: error.code || 'AI_ERROR',
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
    return mapAiError(error, res);
  }
}

router.get('/ai/summaries/voicemail/:id', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await getVoicemailSummary(prisma, tenantId, req.params.id);
    res.json({ success: true, ...result });
  }),
);

router.post('/ai/summaries/voicemail/:id/generate', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await requestVoicemailSummary(prisma, {
      tenantId,
      voicemailId: req.params.id,
      userId: req.user.id,
      transcript: req.body?.transcript,
      tenantName: req.body?.tenantName,
      async: req.body?.async !== false,
    });
    res.status(result.queued ? 202 : 200).json({ success: true, ...result });
  }),
);

router.get('/ai/summaries/call/:id', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await getCallSummary(prisma, tenantId, req.params.id);
    res.json({ success: true, ...result });
  }),
);

router.post('/ai/summaries/call/:id/generate', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await requestCallSummary(prisma, {
      tenantId,
      callId: req.params.id,
      userId: req.user.id,
      transcript: req.body?.transcript,
      tenantName: req.body?.tenantName,
      async: req.body?.async !== false,
    });
    res.status(result.queued ? 202 : 200).json({ success: true, ...result });
  }),
);

router.get('/ai/summaries/conversation/:id', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await getMessageSummary(prisma, tenantId, req.params.id);
    res.json({ success: true, ...result });
  }),
);

router.post('/ai/summaries/conversation/:id/generate', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const result = await requestMessageSummary(prisma, {
      tenantId,
      conversationId: req.params.id,
      userId: req.user.id,
      transcript: req.body?.transcript,
      tenantName: req.body?.tenantName,
      async: req.body?.async !== false,
      force: req.body?.force === true,
    });
    res.status(result.queued ? 202 : 200).json({ success: true, ...result });
  }),
);

module.exports = router;
