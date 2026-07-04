/**
 * Strips credentials and secrets before content is sent to external AI providers.
 */

const SECRET_PATTERNS = [
  /\bAuthorization\s*:\s*[^\n]+/gi,
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*\S+/gi,
  /\b(?:sip:)[^@\s]+:[^@\s]+@/gi,
  /\bsip[_-]?password\s*[:=]\s*\S+/gi,
  /"type"\s*:\s*"vsp-(?:voip|desk)-provision"[\s\S]*?"token"\s*:\s*"[^"]+"/gi,
  /\b(?:Set-Cookie|Cookie)\s*:\s*[^\n]+/gi,
  /\b(?:phone[_-]?credential|credential[_-]?secret)\s*[:=]\s*\S+/gi,
  /\b[A-Za-z0-9+/]{40,}={0,2}\b/g,
];

const REPLACEMENT = '[REDACTED]';

function redactSecrets(text) {
  if (text == null) return '';
  let output = String(text);
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, REPLACEMENT);
  }
  return output;
}

function containsBlockedSecrets(text) {
  if (!text) return false;
  const redacted = redactSecrets(text);
  return redacted.includes(REPLACEMENT);
}

function sanitizeMessages(messages) {
  return (messages || []).map((message) => ({
    ...message,
    content: redactSecrets(message.content),
  }));
}

function assertSafeForProvider(messages) {
  for (const message of messages || []) {
    const original = String(message.content ?? '');
    if (containsBlockedSecrets(original)) {
      return false;
    }
  }
  return true;
}

function scanForSecrets(messages) {
  const findings = [];
  for (const message of messages || []) {
    const original = String(message.content ?? '');
    const redacted = redactSecrets(original);
    if (redacted !== original) {
      findings.push({ role: message.role, redacted: true });
    }
  }
  return findings;
}

module.exports = {
  redactSecrets,
  containsBlockedSecrets,
  sanitizeMessages,
  assertSafeForProvider,
  scanForSecrets,
  REPLACEMENT,
};
