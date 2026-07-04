import { describe, expect, it } from 'vitest';

const { buildIvrCommands } = require('../../lib/telephony-v3/IVR/ivrCommandBuilder');
const { POLICY_ACTION, IVR_ACTION, DESTINATION_TYPE } = require('../../lib/telephony-v3/IVR/ivrConstants');

describe('V3 ivrCommandBuilder', () => {
  it('builds PLAY_GREETING and GATHER on start', () => {
    const commands = buildIvrCommands({
      action: IVR_ACTION.START,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-1',
      menuNode: { greeting: { text: 'Welcome' }, timeoutSec: 8 },
    });
    expect(commands[0].commandType).toBe('PLAY_GREETING');
    expect(commands[1].commandType).toBe('GATHER');
    expect(commands[1].payload.timeoutSec).toBe(8);
  });

  it('builds retry gather after invalid input', () => {
    const commands = buildIvrCommands({
      action: IVR_ACTION.INPUT,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-1',
      menuNode: { invalidPrompt: { text: 'Invalid' } },
    });
    expect(commands.some((c) => c.commandType === 'GATHER')).toBe(true);
  });

  it('builds DIAL and BRIDGE for extension route', () => {
    const commands = buildIvrCommands({
      action: IVR_ACTION.ROUTE,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-1',
      destination: { destination: DESTINATION_TYPE.EXTENSION },
      resolvedTarget: { dialTo: 'sip:agent@sip.telnyx.com', extensionId: 'ext-1' },
    });
    expect(commands[0].commandType).toBe('DIAL');
    expect(commands[1].commandType).toBe('BRIDGE');
  });

  it('builds ENQUEUE for queue route', () => {
    const commands = buildIvrCommands({
      action: IVR_ACTION.ROUTE,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-1',
      destination: { destination: DESTINATION_TYPE.QUEUE },
      resolvedTarget: { queueId: 'q-1' },
    });
    expect(commands[0].commandType).toBe('ENQUEUE');
  });

  it('builds START_VOICEMAIL for voicemail route', () => {
    const commands = buildIvrCommands({
      action: IVR_ACTION.ROUTE,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-1',
      destination: { destination: DESTINATION_TYPE.VOICEMAIL },
      resolvedTarget: { extensionId: 'ext-vm' },
    });
    expect(commands[0].commandType).toBe('START_VOICEMAIL');
  });

  it('builds HANGUP for disconnect', () => {
    const commands = buildIvrCommands({
      action: IVR_ACTION.EXIT,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-1',
      destination: { destination: DESTINATION_TYPE.DISCONNECT },
      resolvedTarget: { type: DESTINATION_TYPE.DISCONNECT },
    });
    expect(commands[0].commandType).toBe('HANGUP');
  });

  it('builds REJECT when policy denied on start', () => {
    const commands = buildIvrCommands({
      action: IVR_ACTION.START,
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'ivr_disabled' },
      callControlId: 'cc-1',
    });
    expect(commands[0].commandType).toBe('REJECT');
  });
});
