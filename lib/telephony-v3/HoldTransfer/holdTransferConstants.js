/** Hold & Transfer shared constants (Phase 3.5). */

const HOLD_ACTION = {
  START: 'START',
  RESUME: 'RESUME',
};

const TRANSFER_TYPE = {
  BLIND: 'BLIND',
  ATTENDED: 'ATTENDED',
};

const TRANSFER_ACTION = {
  START: 'START',
  COMPLETE: 'COMPLETE',
  CANCEL: 'CANCEL',
  FAIL: 'FAIL',
};

const POLICY_ACTION = {
  ALLOW: 'ALLOW',
  DENY: 'DENY',
};

const DEFAULT_LIMITS = {
  transferTimeoutSec: 30,
  maxTransferAttempts: 3,
};

module.exports = {
  HOLD_ACTION,
  TRANSFER_TYPE,
  TRANSFER_ACTION,
  POLICY_ACTION,
  DEFAULT_LIMITS,
};
