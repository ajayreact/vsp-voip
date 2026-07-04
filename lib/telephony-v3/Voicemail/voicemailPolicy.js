const { getPrisma } = require('../internal/prisma');
const { POLICY_ACTION, VOICEMAIL_REASON, DEFAULT_LIMITS } = require('./voicemailConstants');

/** @type {Map<string, number>} */
const voicemailStartedAt = new Map();

function resetVoicemailPolicyForTests() {
  voicemailStartedAt.clear();
}

/**
 * @param {string} reason
 */
function isKnownVoicemailReason(reason) {
  return Object.values(VOICEMAIL_REASON).includes(reason);
}

/**
 * Evaluate voicemail policy (Phase 3.6).
 *
 * @param {{
 *   tenantId: string,
 *   sessionId: string,
 *   reason: string,
 *   voicemailEnabled?: boolean,
 *   observeOnly?: boolean,
 *   extensionId?: string|null,
 *   mailboxId?: string|null,
 *   greetingUrl?: string|null,
 *   maxLength?: number,
 *   voicemailTimeoutSec?: number,
 * }} input
 */
async function evaluateVoicemailPolicy(input) {
  const prisma = await getPrisma();
  const rules = [];
  const limits = {
    voicemailTimeoutSec: input.voicemailTimeoutSec ?? DEFAULT_LIMITS.voicemailTimeoutSec,
    maxLength: input.maxLength ?? DEFAULT_LIMITS.defaultMaxLength,
  };

  if (!input.voicemailEnabled) {
    rules.push({ rule: 'voicemail_enabled', result: 'deny', message: 'Voicemail disabled for tenant' });
    return buildDecision(POLICY_ACTION.DENY, rules, 'voicemail_disabled', input.observeOnly, limits);
  }

  if (!isKnownVoicemailReason(input.reason)) {
    rules.push({ rule: 'voicemail_reason', result: 'deny', message: `Unknown reason ${input.reason}` });
    return buildDecision(POLICY_ACTION.DENY, rules, 'invalid_reason', input.observeOnly, limits);
  }

  if (input.tenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: input.tenantId } });
    if (!tenant) {
      rules.push({ rule: 'tenant', result: 'deny', message: 'Tenant not found' });
      return buildDecision(POLICY_ACTION.DENY, rules, 'tenant_not_found', input.observeOnly, limits);
    }
    rules.push({ rule: 'tenant_restrictions', result: 'pass', message: tenant.id });
  }

  let greetingUrl = input.greetingUrl ?? null;
  let mailboxId = input.mailboxId ?? input.extensionId ?? null;
  let maxLength = limits.maxLength;

  if (input.extensionId) {
    const vmSettings = await prisma.extensionVoicemailSettings.findUnique({
      where: { extensionId: input.extensionId },
    });
    if (vmSettings) {
      if (!vmSettings.enabled) {
        rules.push({ rule: 'extension_voicemail', result: 'deny', message: 'Extension voicemail disabled' });
        return buildDecision(POLICY_ACTION.DENY, rules, 'extension_vm_disabled', input.observeOnly, limits);
      }
      if (!greetingUrl && vmSettings.greetingUrl) {
        greetingUrl = vmSettings.greetingUrl;
      }
      rules.push({ rule: 'mailbox_selection', result: 'pass', message: input.extensionId });
    }
  }

  if (!greetingUrl && input.tenantId) {
    const greeting = await prisma.greeting.findUnique({ where: { tenantId: input.tenantId } });
    if (greeting?.greetingAudioUrl) {
      greetingUrl = greeting.greetingAudioUrl;
    } else if (greeting?.voicemailPrompt) {
      rules.push({ rule: 'greeting_selection', result: 'pass', message: 'text_prompt' });
    }
    if (greeting?.voicemailMaxLength) {
      maxLength = greeting.voicemailMaxLength;
    }
  }

  rules.push({ rule: 'greeting_selection', result: 'pass', message: greetingUrl ? 'audio' : 'default' });
  rules.push({ rule: 'voicemail_timeout', result: 'pass', message: String(limits.voicemailTimeoutSec) });
  rules.push({ rule: 'voicemail_permissions', result: 'pass' });

  return buildDecision(POLICY_ACTION.ALLOW, rules, 'allowed', input.observeOnly, {
    ...limits,
    maxLength,
    greetingUrl,
    mailboxId,
  });
}

/**
 * @param {string} sessionId
 */
function markVoicemailStarted(sessionId) {
  voicemailStartedAt.set(sessionId, Date.now());
}

/**
 * @param {string} sessionId
 * @param {number} timeoutSec
 */
function isVoicemailTimedOut(sessionId, timeoutSec = DEFAULT_LIMITS.voicemailTimeoutSec) {
  const started = voicemailStartedAt.get(sessionId);
  if (!started) return false;
  return Date.now() - started >= timeoutSec * 1000;
}

/**
 * @param {string} sessionId
 */
function clearVoicemailTimer(sessionId) {
  voicemailStartedAt.delete(sessionId);
}

function buildDecision(action, rules, reason, observeOnly, extra = {}) {
  const enforced = !observeOnly;
  const effectiveAction = observeOnly && action === POLICY_ACTION.DENY
    ? POLICY_ACTION.ALLOW
    : action;

  return {
    action,
    effectiveAction,
    enforced,
    observeOnly: Boolean(observeOnly),
    allowed: effectiveAction === POLICY_ACTION.ALLOW,
    reason,
    rules,
    ...extra,
  };
}

module.exports = {
  evaluateVoicemailPolicy,
  markVoicemailStarted,
  isVoicemailTimedOut,
  clearVoicemailTimer,
  resetVoicemailPolicyForTests,
  POLICY_ACTION,
};
