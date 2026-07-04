import { describe, expect, it } from 'vitest';

const { buildMobileCommands, buildConnectCommands } = require('../../lib/telephony-v3/Routing/mobileCommandBuilder');
const { POLICY_ACTION, ROUTING_FLOW } = require('../../lib/telephony-v3/Routing/mobileRouteResult');

describe('V3 mobileCommandBuilder', () => {
  const baseInput = {
    routingFlow: ROUTING_FLOW.MOBILE_TO_MOBILE,
    policy: { effectiveAction: POLICY_ACTION.ALLOW, callerId: null },
    originCallControlId: 'cc-origin',
    destination: { dialTo: 'sip:gencred456@sip.telnyx.com' },
    callerExtension: { extensionNumber: '101' },
    tenantId: 'tenant-1',
    connectionId: 'cred-conn-1',
  };

  it('builds ANSWER, DIAL, BRIDGE for allowed mobile-to-mobile route', () => {
    const commands = buildMobileCommands(baseInput);
    expect(commands.map((c) => c.commandType)).toEqual(['ANSWER', 'DIAL', 'BRIDGE']);
    expect(commands[1].payload.to).toBe(baseInput.destination.dialTo);
    expect(commands[0].payload.phase).toBe(3.3);
  });

  it('builds REJECT for denied policy', () => {
    const commands = buildMobileCommands({
      ...baseInput,
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'blocked' },
    });
    expect(commands).toEqual([expect.objectContaining({ commandType: 'REJECT' })]);
  });

  it('builds SPEAK + HANGUP for voicemail stub', () => {
    const commands = buildMobileCommands({
      ...baseInput,
      policy: { effectiveAction: POLICY_ACTION.VOICEMAIL, reason: 'DND' },
    });
    expect(commands.map((c) => c.commandType)).toEqual(['SPEAK', 'HANGUP']);
  });

  it('builds connect commands for forward policy', () => {
    const commands = buildMobileCommands({
      ...baseInput,
      policy: {
        effectiveAction: POLICY_ACTION.FORWARD,
        targets: [{ phone: '+15551234567' }],
      },
    });
    expect(commands.some((c) => c.commandType === 'DIAL')).toBe(true);
  });

  it('builds unknown destination teardown commands', () => {
    const commands = buildMobileCommands({
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
