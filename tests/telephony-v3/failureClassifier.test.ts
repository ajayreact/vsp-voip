import { describe, expect, it } from 'vitest';

const { classifyFailure, FAILURE_CLASS } = require('../../lib/telephony-v3/Executor/failureClassifier');

describe('V3 failureClassifier', () => {
  it('classifies validation errors as non-retryable', () => {
    const result = classifyFailure(Object.assign(new Error('bad request'), { status: 400 }));
    expect(result.class).toBe(FAILURE_CLASS.VALIDATION);
    expect(result.retryable).toBe(false);
  });

  it('classifies rate limits as retryable', () => {
    const result = classifyFailure(Object.assign(new Error('rate limited'), { status: 429 }));
    expect(result.class).toBe(FAILURE_CLASS.RETRYABLE);
    expect(result.retryable).toBe(true);
  });

  it('classifies 5xx as retryable', () => {
    const result = classifyFailure(Object.assign(new Error('server error'), { status: 503 }));
    expect(result.class).toBe(FAILURE_CLASS.CARRIER);
    expect(result.retryable).toBe(true);
  });

  it('classifies ended calls as permanent idempotent', () => {
    const result = classifyFailure(Object.assign(new Error('Call has ended'), { status: 409 }));
    expect(result.class).toBe(FAILURE_CLASS.PERMANENT);
    expect(result.idempotent).toBe(true);
  });

  it('classifies network timeouts as infrastructure retryable', () => {
    const result = classifyFailure(new Error('connect ETIMEDOUT'));
    expect(result.class).toBe(FAILURE_CLASS.INFRASTRUCTURE);
    expect(result.retryable).toBe(true);
  });

  it('classifies unknown errors as retryable by default', () => {
    const result = classifyFailure(new Error('something odd'));
    expect(result.class).toBe(FAILURE_CLASS.UNKNOWN);
    expect(result.retryable).toBe(true);
  });
});
