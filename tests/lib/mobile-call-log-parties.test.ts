import { describe, it, expect } from 'vitest';
import {
  mapHistoryStatusToServerLog,
  resolveCallLogParties,
} from '../../mobile-rn/src/calling/callLogParties';

describe('mobile callLogParties', () => {
  it('resolves outbound parties with tenant caller ID', () => {
    expect(resolveCallLogParties('outbound', '5551234567', '+15559876543')).toEqual({
      from: '+15559876543',
      to: '+15551234567',
    });
  });

  it('resolves inbound parties with tenant destination', () => {
    expect(resolveCallLogParties('inbound', '+15551234567', '+15559876543')).toEqual({
      from: '+15551234567',
      to: '+15559876543',
    });
  });

  it('maps completed inbound to answered call type', () => {
    expect(mapHistoryStatusToServerLog('completed', 'inbound')).toEqual({
      status: 'ended',
      callType: 'answered',
    });
  });

  it('maps declined inbound to rejected status', () => {
    expect(mapHistoryStatusToServerLog('rejected', 'inbound')).toEqual({
      status: 'rejected',
      callType: 'missed',
    });
  });
});
