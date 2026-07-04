/** Failure classification for Telnyx command execution (Phase 3.1). */

const FAILURE_CLASS = {
  RETRYABLE: 'Retryable',
  PERMANENT: 'Permanent',
  CARRIER: 'Carrier',
  VALIDATION: 'Validation',
  INFRASTRUCTURE: 'Infrastructure',
  UNKNOWN: 'Unknown',
};

/**
 * @param {Error & { status?: number, telnyx?: unknown, code?: string }} error
 * @returns {{ class: string, retryable: boolean, idempotent?: boolean }}
 */
function classifyFailure(error) {
  const status = error?.status;
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (code === 'V3_VALIDATION') {
    return { class: FAILURE_CLASS.VALIDATION, retryable: false };
  }

  if (status === 400 || status === 422) {
    return { class: FAILURE_CLASS.VALIDATION, retryable: false };
  }

  if (
    status === 404
    || status === 409
    || message.includes('call has ended')
    || message.includes('already bridged')
    || message.includes('already answered')
    || message.includes('no longer active')
  ) {
    const idempotent = status === 409
      || message.includes('already')
      || message.includes('ended')
      || message.includes('no longer active');
    return { class: FAILURE_CLASS.PERMANENT, retryable: false, idempotent };
  }

  if (status === 402 || status === 503) {
    return { class: FAILURE_CLASS.CARRIER, retryable: true };
  }

  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return { class: FAILURE_CLASS.RETRYABLE, retryable: true };
  }

  if (
    !status
    && (
      message.includes('timeout')
      || message.includes('etimedout')
      || message.includes('econnreset')
      || message.includes('enotfound')
      || message.includes('network')
    )
  ) {
    return { class: FAILURE_CLASS.INFRASTRUCTURE, retryable: true };
  }

  if (status === 403) {
    return { class: FAILURE_CLASS.PERMANENT, retryable: false };
  }

  return { class: FAILURE_CLASS.UNKNOWN, retryable: true };
}

module.exports = {
  FAILURE_CLASS,
  classifyFailure,
};
