class V3Error extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'V3Error';
    this.code = code;
    this.details = details;
  }
}

class V3RedisRequiredError extends V3Error {
  constructor(message = 'Redis is required for V3 telephony') {
    super('REDIS_REQUIRED', message);
    this.name = 'V3RedisRequiredError';
  }
}

class V3DuplicateError extends V3Error {
  constructor(message = 'Duplicate event') {
    super('DUPLICATE', message);
    this.name = 'V3DuplicateError';
  }
}

class V3NotFoundError extends V3Error {
  constructor(entity, id) {
    super('NOT_FOUND', `${entity} not found`, { entity, id });
    this.name = 'V3NotFoundError';
  }
}

class V3ConflictError extends V3Error {
  constructor(message = 'Optimistic lock conflict') {
    super('CONFLICT', message);
    this.name = 'V3ConflictError';
  }
}

class V3TenantIsolationError extends V3Error {
  constructor(sessionId, tenantId) {
    super('TENANT_ISOLATION', 'Tenant access denied for session', { sessionId, tenantId });
    this.name = 'V3TenantIsolationError';
  }
}

class V3InvalidTransitionError extends V3Error {
  constructor(fsm, fromState, trigger) {
    super('INVALID_TRANSITION', `Invalid ${fsm} transition`, { fsm, fromState, trigger });
    this.name = 'V3InvalidTransitionError';
  }
}

module.exports = {
  V3Error,
  V3RedisRequiredError,
  V3DuplicateError,
  V3NotFoundError,
  V3ConflictError,
  V3TenantIsolationError,
  V3InvalidTransitionError,
};
