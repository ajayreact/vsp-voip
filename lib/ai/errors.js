class AiError extends Error {
  constructor(message, code = 'AI_ERROR', status = 500, details = null) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class AiDisabledError extends AiError {
  constructor(message = 'AI is disabled for this organization') {
    super(message, 'AI_DISABLED', 403);
    this.name = 'AiDisabledError';
  }
}

class AiFeatureDisabledError extends AiError {
  constructor(feature) {
    super(`AI feature "${feature}" is not enabled`, 'AI_FEATURE_DISABLED', 403, { feature });
    this.name = 'AiFeatureDisabledError';
  }
}

class AiBudgetExceededError extends AiError {
  constructor(message = 'AI usage budget exceeded for this billing period') {
    super(message, 'AI_BUDGET_EXCEEDED', 429);
    this.name = 'AiBudgetExceededError';
  }
}

class AiProviderError extends AiError {
  constructor(message, provider, status = 502, details = null) {
    super(message, 'AI_PROVIDER_ERROR', status, { provider, ...(details || {}) });
    this.name = 'AiProviderError';
  }
}

class AiRedactionError extends AiError {
  constructor(message = 'Content blocked: sensitive data detected') {
    super(message, 'AI_REDACTION_BLOCKED', 400);
    this.name = 'AiRedactionError';
  }
}

class AiPolicyError extends AiError {
  constructor(message, code = 'AI_POLICY_VIOLATION', details = null) {
    const status = typeof details?.status === 'number' ? details.status : 403;
    super(message, code, status, details);
    this.name = 'AiPolicyError';
  }
}

function isRetryableAiError(error) {
  if (!error) return false;
  if (error.code === 'AI_PROVIDER_ERROR') {
    const status = error.status || 0;
    return status === 429 || status === 502 || status === 503 || status === 504;
  }
  return false;
}

module.exports = {
  AiError,
  AiDisabledError,
  AiFeatureDisabledError,
  AiBudgetExceededError,
  AiProviderError,
  AiRedactionError,
  AiPolicyError,
  isRetryableAiError,
};
