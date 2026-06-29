const SUPPORTED_INTENTS = [
  'search_calls',
  'search_messages',
  'search_voicemails',
  'search_contacts',
  'daily_summary',
  'customer_summary',
  'follow_up_detection',
  'callback_recommendations',
  'priority_detection',
  'conversation_search',
  'general_search',
];

const SUGGESTED_PROMPTS = [
  "Show today's missed calls",
  'Summarize today\'s activity',
  'Show unread SMS',
  'Which voicemails are high priority?',
  'Show today\'s callbacks',
  'Which customers need follow-up?',
  'Show all conversations about pricing',
];

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function extractSearchTerms(question) {
  const quoted = question.match(/"([^"]+)"/);
  if (quoted) return quoted[1].trim();

  const invoice = question.match(/invoice\s*#?\s*(\w+)/i);
  if (invoice) return invoice[1];

  const name = question.match(/(?:find|show|summarize)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (name) return name[1];

  const about = question.match(/about\s+([a-z0-9\s-]+)/i);
  if (about) return about[1].trim();

  return null;
}

function classifyIntent(question) {
  const q = String(question || '').trim();
  const lower = q.toLowerCase();
  const terms = extractSearchTerms(q);
  const today = lower.includes('today');

  if (/missed call|missed calls/.test(lower)) {
    return { intent: 'search_calls', filters: { status: 'missed', today } };
  }
  if (/unread sms|unread message|unread messages/.test(lower)) {
    return { intent: 'search_messages', filters: { unreadOnly: true } };
  }
  if (/voicemail/.test(lower) && /high priority|priority/.test(lower)) {
    return { intent: 'priority_detection', filters: { entityType: 'voicemail', priority: 'High' } };
  }
  if (/callback|call back/.test(lower)) {
    return { intent: 'callback_recommendations', filters: { today } };
  }
  if (/follow[- ]?up|need follow/.test(lower)) {
    return { intent: 'follow_up_detection', filters: {} };
  }
  if (/daily summary|today'?s activity|summarize today/.test(lower)) {
    return { intent: 'daily_summary', filters: { today: true } };
  }
  if (/summarize this customer|customer summary/.test(lower)) {
    return { intent: 'customer_summary', filters: { customer: terms } };
  }
  if (/conversation/.test(lower) || /sms|message/.test(lower) && /about|pricing|invoice/.test(lower)) {
    return { intent: 'conversation_search', filters: { query: terms || q } };
  }
  if (/contact|employee|extension/.test(lower)) {
    return { intent: 'search_contacts', filters: { query: terms || q } };
  }
  if (/voicemail/.test(lower)) {
    return { intent: 'search_voicemails', filters: { query: terms, today } };
  }
  if (/call history|calls|call/.test(lower)) {
    return { intent: 'search_calls', filters: { query: terms, today } };
  }

  return { intent: 'general_search', filters: { query: q } };
}

module.exports = {
  SUPPORTED_INTENTS,
  SUGGESTED_PROMPTS,
  classifyIntent,
  extractSearchTerms,
  startOfUtcDay,
};
