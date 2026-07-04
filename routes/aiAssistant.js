const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware } = require('../lib/auth');
const { assertTenantActive } = require('../lib/tenantGuard');
const {
  runAssistantQuery,
  runAssistantStream,
  getSuggestedPrompts,
} = require('../lib/ai/assistant');

const router = express.Router();

function resolveTenantId(req) {
  if (req.user.role === 'SUPER_ADMIN' && req.query.tenantId) {
    return String(req.query.tenantId);
  }
  return req.user.tenantId;
}

function mapAssistantError(error, res) {
  const status = error.status || 500;
  return res.status(status).json({
    error: error.message || 'Assistant request failed',
    code: error.code || 'AI_ASSISTANT_ERROR',
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
    return mapAssistantError(error, res);
  }
}

router.get('/ai/assistant/suggestions', authMiddleware, (_req, res) => {
  res.json({ success: true, suggestions: getSuggestedPrompts() });
});

router.post('/ai/assistant/query', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    const response = await runAssistantQuery(prisma, {
      tenantId,
      userId: req.user.id,
      question,
      tenantName: req.body?.tenantName,
      useCache: req.body?.useCache !== false,
    });
    res.json({ success: true, response });
  }),
);

router.post('/ai/assistant/stream', authMiddleware, (req, res) =>
  withTenantContext(req, res, async (prisma, tenantId) => {
    const question = String(req.body?.question || '').trim();
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      for await (const chunk of runAssistantStream(prisma, {
        tenantId,
        userId: req.user.id,
        question,
        tenantName: req.body?.tenantName,
      })) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message, code: error.code })}\n\n`);
      res.end();
    }
  }),
);

module.exports = router;
