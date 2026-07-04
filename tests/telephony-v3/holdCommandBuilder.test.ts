import { describe, expect, it } from 'vitest';

const { buildHoldCommands, buildResumeCommands } = require('../../lib/telephony-v3/HoldTransfer/holdCommandBuilder');
const { POLICY_ACTION } = require('../../lib/telephony-v3/HoldTransfer/holdPolicy');

describe('V3 holdCommandBuilder', () => {
  it('builds HOLD command', () => {
    const commands = buildHoldCommands({
      callControlId: 'cc-1',
      legId: 'leg-1',
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
    });
    expect(commands).toEqual([expect.objectContaining({ commandType: 'HOLD' })]);
  });

  it('builds UNHOLD command', () => {
    const commands = buildResumeCommands({
      callControlId: 'cc-1',
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
    });
    expect(commands).toEqual([expect.objectContaining({ commandType: 'UNHOLD' })]);
  });

  it('builds REJECT on deny', () => {
    const commands = buildHoldCommands({
      callControlId: 'cc-1',
      policy: { effectiveAction: POLICY_ACTION.DENY },
    });
    expect(commands[0].commandType).toBe('REJECT');
  });
});
