const { stripJsonFence } = require('../modules/structuredOutput');
const { AiPolicyError } = require('../errors');

function parseAssistantResponse(content) {
  const raw = stripJsonFence(content);
  if (!raw) {
    throw new AiPolicyError('Assistant returned empty response', 'AI_ASSISTANT_EMPTY');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      summary: raw.trim(),
      insights: [],
      results: [],
      suggestedActions: [],
      followUps: [],
    };
  }

  return {
    summary: String(parsed.summary || parsed.answer || '').trim(),
    insights: Array.isArray(parsed.insights) ? parsed.insights.map(String) : [],
    results: Array.isArray(parsed.results) ? parsed.results : [],
    suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions.map(String) : [],
    followUps: Array.isArray(parsed.followUps) ? parsed.followUps.map(String) : [],
    priority: parsed.priority || null,
    sentiment: parsed.sentiment || null,
  };
}

function normalizeAssistantResponse(parsed, { intent, searchData, provider, model }) {
  const searchResults = searchData.results || [];
  return {
    intent,
    summary: parsed.summary || 'No summary available.',
    insights: parsed.insights || [],
    results: searchResults.length ? searchResults : parsed.results || [],
    suggestedActions: parsed.suggestedActions || [],
    followUps: parsed.followUps || [],
    priority: parsed.priority || null,
    sentiment: parsed.sentiment || null,
    sources: searchData.sources || [],
    stats: searchData.stats || null,
    generatedAt: new Date().toISOString(),
    provider: provider || 'unknown',
    model: model || 'unknown',
  };
}

module.exports = {
  parseAssistantResponse,
  normalizeAssistantResponse,
};
