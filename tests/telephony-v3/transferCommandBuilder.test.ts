import { describe, expect, it } from 'vitest';

const { buildTransferCommands } = require('../../lib/telephony-v3/HoldTransfer/transferCommandBuilder');
const { POLICY_ACTION, TRANSFER_TYPE, TRANSFER_ACTION } = require('../../lib/telephony-v3/HoldTransfer/holdTransferConstants');

describe('V3 transferCommandBuilder', () => {
  const base = {
    originCallControlId: 'cc-origin',
    policy: { effectiveAction: POLICY_ACTION.ALLOW, transferTimeoutSec: 30 },
  };

  it('builds blind TRANSFER command', () => {
    const commands = buildTransferCommands({
      ...base,
      transferType: TRANSFER_TYPE.BLIND,
      target: '+15551234567',
    });
    expect(commands).toEqual([expect.objectContaining({ commandType: 'TRANSFER' })]);
  });

  it('builds attended start HOLD + DIAL', () => {
    const commands = buildTransferCommands({
      ...base,
      transferType: TRANSFER_TYPE.ATTENDED,
      action: TRANSFER_ACTION.START,
      target: 'sip:consult@sip.telnyx.com',
    });
    expect(commands.map((c) => c.commandType)).toEqual(['HOLD', 'DIAL']);
  });

  it('builds attended complete BRIDGE + HANGUP', () => {
    const commands = buildTransferCommands({
      ...base,
      transferType: TRANSFER_TYPE.ATTENDED,
      action: TRANSFER_ACTION.COMPLETE,
      consultCallControlId: 'cc-consult',
    });
    expect(commands.some((c) => c.commandType === 'BRIDGE')).toBe(true);
  });

  it('builds fail UNHOLD + HANGUP', () => {
    const commands = buildTransferCommands({
      ...base,
      transferType: TRANSFER_TYPE.ATTENDED,
      action: TRANSFER_ACTION.FAIL,
      consultCallControlId: 'cc-consult',
    });
    expect(commands.some((c) => c.commandType === 'UNHOLD')).toBe(true);
  });
});
