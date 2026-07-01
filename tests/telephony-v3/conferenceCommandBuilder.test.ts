import { describe, expect, it } from 'vitest';

const { buildConferenceCommands } = require('../../lib/telephony-v3/Conference/conferenceCommandBuilder');
const { POLICY_ACTION, CONFERENCE_ACTION } = require('../../lib/telephony-v3/Conference/conferenceConstants');

describe('V3 conferenceCommandBuilder', () => {
  it('builds CREATE_CONFERENCE', () => {
    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.CREATE,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-host',
      conferenceId: 'conf-1',
      conferenceName: 'conf-1',
    });
    expect(commands[0].commandType).toBe('CREATE_CONFERENCE');
  });

  it('builds ADD_PARTICIPANT for join', () => {
    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.JOIN,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-host',
      participantCallControlId: 'cc-p2',
      conferenceId: 'conf-1',
    });
    expect(commands[0].commandType).toBe('ADD_PARTICIPANT');
  });

  it('builds merge commands', () => {
    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.MERGE,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-a',
      otherCallControlId: 'cc-b',
      conferenceId: 'conf-1',
    });
    expect(commands).toHaveLength(2);
    expect(commands[0].commandType).toBe('BRIDGE');
    expect(commands[1].commandType).toBe('ADD_PARTICIPANT');
  });

  it('builds mute and unmute', () => {
    const mute = buildConferenceCommands({
      action: CONFERENCE_ACTION.MUTE,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-host',
      participantCallControlId: 'cc-p2',
      conferenceId: 'conf-1',
    });
    expect(mute[0].commandType).toBe('MUTE_PARTICIPANT');

    const unmute = buildConferenceCommands({
      action: CONFERENCE_ACTION.UNMUTE,
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      callControlId: 'cc-host',
      participantCallControlId: 'cc-p2',
      conferenceId: 'conf-1',
    });
    expect(unmute[0].commandType).toBe('UNMUTE_PARTICIPANT');
  });

  it('builds REJECT when denied', () => {
    const commands = buildConferenceCommands({
      action: CONFERENCE_ACTION.CREATE,
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'conference_disabled' },
      callControlId: 'cc-1',
    });
    expect(commands[0].commandType).toBe('REJECT');
  });
});
