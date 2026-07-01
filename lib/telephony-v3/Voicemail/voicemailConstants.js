/** Voicemail shared constants (Phase 3.6). */

const VOICEMAIL_REASON = {
  NO_ANSWER: 'NO_ANSWER',
  BUSY: 'BUSY',
  DND: 'DND',
  POLICY: 'POLICY',
};

const VOICEMAIL_ACTION = {
  START: 'START',
  STOP: 'STOP',
  COMPLETE: 'COMPLETE',
};

const POLICY_ACTION = {
  ALLOW: 'ALLOW',
  DENY: 'DENY',
};

const DEFAULT_LIMITS = {
  voicemailTimeoutSec: 120,
  defaultMaxLength: 120,
};

module.exports = {
  VOICEMAIL_REASON,
  VOICEMAIL_ACTION,
  POLICY_ACTION,
  DEFAULT_LIMITS,
};
