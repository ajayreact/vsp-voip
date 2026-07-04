import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSet = vi.fn();
const mockDel = vi.fn();
const mockGet = vi.fn();

const requireRedis = require('../../lib/telephony-v3/Redis/requireRedis');
const timerService = require('../../lib/telephony-v3/Timer/timerService');

describe('V3 TimerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(requireRedis, 'requireV3Redis').mockResolvedValue({
      set: mockSet,
      del: mockDel,
      get: mockGet,
    });
  });

  it('schedules timer with NX', async () => {
    mockSet.mockResolvedValue('OK');
    const result = await timerService.scheduleTimer('sess-1', 'ring', 30);
    expect(result.scheduled).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      'v3:timer:sess-1:ring',
      expect.any(String),
      'EX',
      30,
      'NX',
    );
  });

  it('cancels timer key', async () => {
    mockDel.mockResolvedValue(1);
    expect(await timerService.cancelTimer('sess-1', 'ring')).toBe(true);
    expect(mockDel).toHaveBeenCalledWith('v3:timer:sess-1:ring');
  });

  it('checks timer active state', async () => {
    mockGet.mockResolvedValue('{"sessionId":"sess-1"}');
    expect(await timerService.isTimerActive('sess-1', 'ring')).toBe(true);
  });
});
