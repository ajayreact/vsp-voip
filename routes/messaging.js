const express = require('express');
const { getPrisma } = require('../db');
const { authMiddleware } = require('../lib/auth');
const { normalizePhoneNumber } = require('../lib/phone');
const { assertTenantActive } = require('../lib/tenantGuard');
const { loadPlatformSettings } = require('../lib/platformSettings');
const {
  listConversations,
  getConversationMessages,
  markConversationRead,
  sendMessage,
  syncMessageStatuses,
  getMessageStatusDetail,
  uploadAttachment,
  mapMessageRecord,
} = require('../lib/messaging');

const router = express.Router();

function resolveTenantId(req) {
  if (req.user.role === 'SUPER_ADMIN' && req.query.tenantId) {
    return String(req.query.tenantId);
  }
  return req.user.tenantId;
}

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const conversations = await listConversations(prisma, tenantId, req.user.sub, {
      limit: req.query.limit,
      cursor: req.query.cursor,
    });

    res.json({
      success: true,
      count: conversations.length,
      conversations,
      nextCursor: conversations.length ? conversations[conversations.length - 1].id : null,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load conversations' });
  }
});

router.get('/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    let messages = await getConversationMessages(prisma, req.params.id, tenantId, {
      limit: req.query.limit,
      cursor: req.query.cursor,
    });

    const platformMessages = await prisma.message.findMany({
      where: { id: { in: messages.map((item) => item.id) } },
      include: { attachments: true },
    });
    const synced = await syncMessageStatuses(prisma, platformMessages);
    const syncedById = new Map(synced.map((item) => [item.id, mapMessageRecord(item)]));
    messages = messages.map((item) => syncedById.get(item.id) || item);

    res.json({
      success: true,
      conversationId: req.params.id,
      count: messages.length,
      messages,
      nextCursor: messages.length ? messages[0].id : null,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load messages' });
  }
});

router.patch('/conversations/:id/read', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const result = await markConversationRead(prisma, {
      conversationId: req.params.id,
      tenantId,
      userId: req.user.sub,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to mark conversation read' });
  }
});

router.post('/messages/send', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const { from, to, text, attachmentIds } = req.body;
    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);
    const platform = await loadPlatformSettings(prisma);

    let message = await sendMessage({
      prisma,
      platform,
      tenantId,
      userId: req.user.sub,
      from,
      to,
      text,
      attachmentIds,
    });

    const platformMessage = await prisma.message.findUnique({
      where: { id: message.id },
      include: { attachments: true },
    });
    if (platformMessage) {
      const [synced] = await syncMessageStatuses(prisma, [platformMessage]);
      message = mapMessageRecord(synced || platformMessage);
    }

    res.json({ success: true, message });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to send message' });
  }
});

router.post('/messages/attachments', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    await assertTenantActive(prisma, tenantId);

    const attachment = await uploadAttachment(prisma, tenantId, {
      data: req.body.data,
      filename: req.body.filename,
      mimeType: req.body.mimeType,
    });

    res.json({ success: true, attachment });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to upload attachment' });
  }
});

router.get('/messages/:id/status', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const prisma = await getPrisma();
    const message = await getMessageStatusDetail(prisma, req.params.id, tenantId);

    res.json({
      success: true,
      messageId: message.id,
      status: message.status,
      deliveryError: message.deliveryError,
      deliveredAt: message.deliveredAt,
      history: message.statusHistory,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to load message status' });
  }
});

router.get('/conversations/by-peer', authMiddleware, async (req, res) => {
  try {
    const tenantId = resolveTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'No organization linked to this account' });
    }

    const peer = normalizePhoneNumber(req.query.peer);
    const line = normalizePhoneNumber(req.query.line);
    if (!peer || !line) {
      return res.status(400).json({ error: 'peer and line query parameters are required' });
    }

    const prisma = await getPrisma();
    const ownedLine = await prisma.phoneNumber.findFirst({
      where: { tenantId, number: line },
    });
    if (!ownedLine) {
      return res.status(403).json({ error: 'Line number is not assigned to your organization' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        tenantId_peer_line: { tenantId, peer, line },
      },
    });

    if (!conversation) {
      return res.json({ success: true, conversation: null });
    }

    res.json({ success: true, conversation: { id: conversation.id, peer, line } });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Failed to resolve conversation' });
  }
});

module.exports = router;
