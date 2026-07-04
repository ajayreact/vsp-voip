const { getAiConfig } = require('./config');
const { sanitizeMessages } = require('./redaction');

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function estimateMessagesTokens(messages) {
  return (messages || []).reduce((sum, message) => sum + estimateTokens(message.content) + 4, 0);
}

/**
 * In-memory conversation context for AI modules.
 * Not persisted to telephony or messaging stores.
 */
class AiContextManager {
  constructor(options = {}) {
    this.tenantId = options.tenantId;
    this.userId = options.userId || null;
    this.metadata = { ...(options.metadata || {}) };
    this.messages = [];
    this.maxMessages = options.maxMessages || getAiConfig().defaultMaxContextMessages;
  }

  addMessage(role, content, meta = {}) {
    this.messages.push({
      role,
      content: String(content ?? ''),
      meta,
      addedAt: new Date().toISOString(),
    });
    this.trim();
    return this;
  }

  addSystem(content) {
    return this.addMessage('system', content);
  }

  addUser(content) {
    return this.addMessage('user', content);
  }

  addAssistant(content) {
    return this.addMessage('assistant', content);
  }

  trim() {
    if (this.messages.length <= this.maxMessages) return;
    const systemMessages = this.messages.filter((m) => m.role === 'system');
    const otherMessages = this.messages.filter((m) => m.role !== 'system');
    const keepOthers = otherMessages.slice(-Math.max(1, this.maxMessages - systemMessages.length));
    this.messages = [...systemMessages, ...keepOthers];
  }

  toProviderMessages({ applyRedaction = true } = {}) {
    const mapped = this.messages.map(({ role, content }) => ({ role, content }));
    return applyRedaction ? sanitizeMessages(mapped) : mapped;
  }

  snapshot() {
    return {
      tenantId: this.tenantId,
      userId: this.userId,
      metadata: this.metadata,
      messageCount: this.messages.length,
      estimatedTokens: estimateMessagesTokens(this.messages),
    };
  }
}

function createContext(options) {
  return new AiContextManager(options);
}

module.exports = {
  AiContextManager,
  createContext,
  estimateTokens,
  estimateMessagesTokens,
};
