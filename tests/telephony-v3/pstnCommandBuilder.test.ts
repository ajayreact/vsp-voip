import { describe, expect, it } from 'vitest';

const {
  buildPstnCommands,
  buildConnectCommands,
  buildRingGroupCommands,
} = require('../../lib/telephony-v3/Routing/pstnCommandBuilder');
const { POLICY_ACTION, ROUTING_FLOW } = require('../../lib/telephony-v3/Routing/pstnRouteResult');

describe('V3 pstnCommandBuilder', () => {
  const baseInput = {
    routingFlow: ROUTING_FLOW.PSTN_TO_DESK,
    policy: { effectiveAction: POLICY_ACTION.ALLOW },
    originCallControlId: 'cc-pstn',
    destination: { dialTo: 'sip:desk101@sip.telnyx.com' },
    tenantId: 'tenant-1',
    connectionId: 'conn-1',
  };

  it('builds ANSWER, DIAL, BRIDGE for incoming PSTN to desk', () => {
    const commands = buildPstnCommands(baseInput);
    expect(commands.map((c) => c.commandType)).toEqual(['ANSWER', 'DIAL', 'BRIDGE']);
    expect(commands[0].payload.phase).toBe(3.4);
  });

  it('builds REJECT for denied policy', () => {
    const commands = buildPstnCommands({
      ...baseInput,
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'blocked' },
    });
    expect(commands).toEqual([expect.objectContaining({ commandType: 'REJECT' })]);
  });

  it('builds SPEAK + HANGUP for unknown DID', () => {
    const commands = buildPstnCommands({
      ...baseInput,
      routingFlow: ROUTING_FLOW.UNKNOWN,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      destination: null,
    });
    expect(commands.map((c) => c.commandType)).toEqual(['SPEAK', 'HANGUP']);
  });

  it('builds sequential DIAL commands for ring group', () => {
    const commands = buildRingGroupCommands({
      ...baseInput,
      routingFlow: ROUTING_FLOW.PSTN_TO_RING_GROUP,
      destination: {
        ringGroupId: 'rg-1',
        dialTargets: ['sip:a@sip.telnyx.com', 'sip:b@sip.telnyx.com'],
      },
    });
    const dials = commands.filter((c) => c.commandType === 'DIAL');
    expect(dials.length).toBe(2);
    expect(dials[0].payload.memberIndex).toBe(0);
    expect(dials[1].payload.memberIndex).toBe(1);
    expect(commands.some((c) => c.commandType === 'BRIDGE')).toBe(true);
  });

  it('builds FORWARD intent for forward policy', () => {
    const commands = buildPstnCommands({
      ...baseInput,
      policy: {
        effectiveAction: POLICY_ACTION.FORWARD,
        targets: [{ phone: '+15551234567' }],
      },
    });
    expect(commands.map((c) => c.commandType)).toEqual(['ANSWER', 'FORWARD', 'BRIDGE']);
  });

  it('builds voicemail stub commands', () => {
    const commands = buildPstnCommands({
      ...baseInput,
      routingFlow: ROUTING_FLOW.PSTN_TO_VOICEMAIL,
      policy: { effectiveAction: POLICY_ACTION.VOICEMAIL, reason: 'DND' },
    });
    expect(commands.map((c) => c.commandType)).toEqual(['SPEAK', 'HANGUP']);
  });

  it('buildConnectCommands hangs up when dial target missing', () => {
    const commands = buildConnectCommands({
      ...baseInput,
      destination: {},
    });
    expect(commands.map((c) => c.commandType)).toEqual(['ANSWER', 'HANGUP']);
  });
});
