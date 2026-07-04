const { redactSecrets } = require('../redaction');

function compactItem(item) {
  return {
    type: item.type,
    id: item.id,
    title: redactSecrets(String(item.title || '')),
    subtitle: redactSecrets(String(item.subtitle || '')).slice(0, 200),
    meta: item.meta || {},
  };
}

function buildAssistantContext({ question, intent, searchData }) {
  const payload = {
    question,
    intent,
    stats: searchData.stats || null,
    calls: (searchData.calls || searchData.results?.filter((r) => r.type === 'call') || []).slice(0, 10).map(compactItem),
    voicemails: (searchData.voicemails || searchData.results?.filter((r) => r.type === 'voicemail') || []).slice(0, 10).map(compactItem),
    messages: (searchData.messages || searchData.results?.filter((r) => r.type === 'message') || []).slice(0, 10).map(compactItem),
    contacts: (searchData.results?.filter((r) => r.type === 'contact') || []).slice(0, 10).map(compactItem),
    summaries: (searchData.summaries || searchData.results?.filter((r) => r.type === 'summary') || []).slice(0, 10).map(compactItem),
    transcripts: (searchData.transcripts || []).slice(0, 5).map(compactItem),
    results: (searchData.results || []).slice(0, 15).map(compactItem),
  };

  return JSON.stringify(payload, null, 2);
}

function buildAssistantMessages({ question, contextJson, tenantName }) {
  return [
    {
      role: 'system',
      content: `You are VSP Phone AI Enterprise Assistant for ${tenantName || 'the organization'}.
Use ONLY the provided enterprise context JSON. Do not invent records.
Respond with ONLY valid JSON (no markdown):
{
  "summary": "string",
  "insights": ["string"],
  "suggestedActions": ["string"],
  "followUps": ["string"],
  "priority": "Low|Medium|High|null",
  "sentiment": "string|null"
}
Never include credentials, tokens, or secrets.`,
    },
    {
      role: 'user',
      content: `Question: ${question}\n\nEnterprise context:\n${contextJson}`,
    },
  ];
}

module.exports = {
  buildAssistantContext,
  buildAssistantMessages,
};
