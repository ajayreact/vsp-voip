import { describe, expect, it } from 'vitest';

const keys = require('../../lib/telephony-v3/Redis/keys');

describe('V3 Redis keys', () => {
  it('builds canonical key names', () => {
    expect(keys.sessionKey('sess-1')).toBe('v3:session:sess-1');
    expect(keys.legKey('leg-1')).toBe('v3:leg:leg-1');
    expect(keys.lockKey('sess-1')).toBe('v3:lock:session:sess-1');
    expect(keys.timerKey('sess-1', 'ring')).toBe('v3:timer:sess-1:ring');
    expect(keys.flagKey('tenant-a')).toBe('v3:flags:tenant-a');
    expect(keys.heartbeatKey('worker-1')).toBe('v3:worker:heartbeat:worker-1');
  });
});
