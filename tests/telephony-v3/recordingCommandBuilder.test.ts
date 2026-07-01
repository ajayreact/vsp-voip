import { describe, expect, it } from 'vitest';

const { buildRecordingCommands } = require('../../lib/telephony-v3/Recording/recordingCommandBuilder');
const { POLICY_ACTION } = require('../../lib/telephony-v3/Recording/recordingConstants');
const { RECORDING_ACTION } = require('../../lib/telephony-v3/Recording/recordingConstants');

describe('V3 recordingCommandBuilder', () => {
  it('builds START_RECORDING for allowed policy', () => {
    const commands = buildRecordingCommands({
      callControlId: 'cc-1',
      legId: 'leg-1',
      policy: { effectiveAction: POLICY_ACTION.ALLOW, retentionDays: 90 },
      mode: 'MANUAL',
      action: RECORDING_ACTION.START,
    });
    expect(commands).toHaveLength(1);
    expect(commands[0].commandType).toBe('START_RECORDING');
    expect(commands[0].payload.retentionDays).toBe(90);
  });

  it('builds STOP_RECORDING', () => {
    const commands = buildRecordingCommands({
      callControlId: 'cc-1',
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      action: RECORDING_ACTION.STOP,
    });
    expect(commands[0].commandType).toBe('STOP_RECORDING');
  });

  it('builds REJECT when denied', () => {
    const commands = buildRecordingCommands({
      callControlId: 'cc-1',
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'recording_disabled' },
    });
    expect(commands[0].commandType).toBe('REJECT');
  });
});
