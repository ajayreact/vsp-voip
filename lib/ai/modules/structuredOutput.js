const { AiPolicyError } = require('../errors');

const PRIORITIES = new Set(['Low', 'Medium', 'High']);

function stripJsonFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced) return fenced[1].trim();
  const inline = trimmed.match(/\{[\s\S]*\}/);
  return inline ? inline[0] : trimmed;
}

function parseAiJsonResponse(content) {
  const raw = stripJsonFence(content);
  if (!raw) {
    throw new AiPolicyError('AI returned empty response', 'AI_MALFORMED_RESPONSE');
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new AiPolicyError('AI response is not valid JSON', 'AI_MALFORMED_RESPONSE', { raw: raw.slice(0, 200) });
  }
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizePriority(value) {
  const normalized = String(value || 'Medium');
  return PRIORITIES.has(normalized) ? normalized : 'Medium';
}

function normalizeConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0.5;
  return Math.min(1, Math.max(0, num));
}

function validateBaseSummary(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new AiPolicyError('AI summary must be a JSON object', 'AI_MALFORMED_RESPONSE');
  }
  if (!obj.summary || typeof obj.summary !== 'string' || !obj.summary.trim()) {
    throw new AiPolicyError('AI summary missing required "summary" field', 'AI_MALFORMED_RESPONSE');
  }
}

function normalizeStructuredSummary(parsed, { provider, model, moduleType }) {
  validateBaseSummary(parsed);

  const generatedAt = new Date().toISOString();
  const base = {
    summary: parsed.summary.trim(),
    keyPoints: asStringArray(parsed.keyPoints),
    actionItems: asStringArray(parsed.actionItems),
    priority: normalizePriority(parsed.priority),
    sentiment: String(parsed.sentiment || 'Neutral').trim() || 'Neutral',
    confidence: normalizeConfidence(parsed.confidence),
    generatedAt,
    provider: provider || parsed.provider || 'unknown',
    model: model || parsed.model || 'unknown',
  };

  if (moduleType === 'voicemail') {
    return {
      ...base,
      callbackRecommendation: String(parsed.callbackRecommendation || 'Unknown').trim() || 'Unknown',
    };
  }

  if (moduleType === 'call') {
    return {
      ...base,
      executiveSummary: String(parsed.executiveSummary || parsed.summary || '').trim(),
      discussionTopics: asStringArray(parsed.discussionTopics || parsed.keyPoints),
      customerIntent: String(parsed.customerIntent || '').trim(),
      followUpTasks: asStringArray(parsed.followUpTasks || parsed.actionItems),
      salesOpportunity: String(parsed.salesOpportunity || 'None').trim() || 'None',
    };
  }

  if (moduleType === 'conversation') {
    return {
      ...base,
      conversationSummary: String(parsed.conversationSummary || parsed.summary || '').trim(),
      outstandingQuestions: asStringArray(parsed.outstandingQuestions),
      unreadRequests: asStringArray(parsed.unreadRequests),
      customerIntent: String(parsed.customerIntent || '').trim(),
      latestDecision: String(parsed.latestDecision || '').trim(),
    };
  }

  return base;
}

module.exports = {
  PRIORITIES,
  parseAiJsonResponse,
  validateBaseSummary,
  normalizeStructuredSummary,
  stripJsonFence,
};
