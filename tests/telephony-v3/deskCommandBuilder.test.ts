import { describe, expect, it } from 'vitest';

const { buildDeskCommands, buildConnectCommands } = require('../../lib/telephony-v3/Routing/deskCommandBuilder');
const { POLICY_ACTION, ROUTING_FLOW } = require('../../lib/telephony-v3/Routing/deskRouteResult');

describe('V3 deskCommandBuilder', () => {
  const baseInput = {
    routingFlow: ROUTING_FLOW.DESK_TO_DESK,
    policy: { effectiveAction: POLICY_ACTION.ALLOW, callerId: null },
    originCallControlId: 'cc-origin',
    destination: { dialTo: 'sip:target@gencred123@sip.telnyx.com' },
    callerExtension: { extensionNumber: '101' },
    tenantId: 'tenant-1',
    connectionId: 'conn-1',
  };

  it('builds ANSWER, DIAL, BRIDGE for allowed desk-to-desk route', () => {
    const commands = buildDeskCommands(baseInput);
    expect(commands.map((c) => c.commandType)).toEqual(['ANSWER', 'DIAL', 'BRIDGE']);
    expect(commands[1].payload.to).toBe(baseInput.destination.dialTo);
  });

  it('builds REJECT for denied policy', () => {
    const commands = buildDeskCommands({
      ...baseInput,
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'blocked' },
    });
    expect(commands).toEqual([expect.objectContaining({ commandType: 'REJECT' })]);
  });

  it('builds SPEAK + HANGUP for voicemail stub', () => {
    const commands = buildDeskCommands({
      ...baseInput,
      policy: { effectiveAction: POLICY_ACTION.VOICEMAIL, reason: 'DND' },
    });
    expect(commands.map((c) => c.commandType)).toEqual(['SPEAK', 'HANGUP']);
  });

  it('builds connect commands for forward policy', () => {
    const commands = buildDeskCommands({
      ...baseInput,
      policy: {
        effectiveAction: POLICY_ACTION.FORWARD,
        targets: [{ phone: '+15551234567' }],
      },
    });
    expect(commands.some((c) => c.commandType === 'DIAL')).toBe(true);
  });

  it('builds stub commands for ring group flow', () => {
    const commands = buildDeskCommands({
      ...baseInput,
      routingFlow: ROUTING_FLOW.RING_GROUP,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
    });
    expect(commands[0].commandType).toBe('SPEAK');
    expect(commands[1].commandType).toBe('HANGUP');
  });

  it('builds unknown destination teardown commands', () => {
    const commands = buildDeskCommands({
      ...baseInput,
      routingFlow: ROUTING_FLOW.UNKNOWN,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      destination: null,
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
