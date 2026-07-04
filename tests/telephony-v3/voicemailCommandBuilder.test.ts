import { describe, expect, it } from 'vitest';

const { buildVoicemailCommands } = require('../../lib/telephony-v3/Voicemail/voicemailCommandBuilder');
const { POLICY_ACTION, VOICEMAIL_ACTION } = require('../../lib/telephony-v3/Voicemail/voicemailConstants');

describe('V3 voicemailCommandBuilder', () => {
  it('builds PLAY_GREETING and START_VOICEMAIL', () => {
    const commands = buildVoicemailCommands({
      callControlId: 'cc-1',
      policy: {
        effectiveAction: POLICY_ACTION.ALLOW,
        greetingUrl: 'https://example.com/greeting.mp3',
        maxLength: 120,
        voicemailTimeoutSec: 90,
      },
      action: VOICEMAIL_ACTION.START,
    });
    expect(commands).toHaveLength(2);
    expect(commands[0].commandType).toBe('PLAY_GREETING');
    expect(commands[1].commandType).toBe('START_VOICEMAIL');
  });

  it('builds STOP_VOICEMAIL', () => {
    const commands = buildVoicemailCommands({
      callControlId: 'cc-1',
      policy: { effectiveAction: POLICY_ACTION.ALLOW },
      action: VOICEMAIL_ACTION.STOP,
    });
    expect(commands[0].commandType).toBe('STOP_VOICEMAIL');
  });

  it('builds REJECT when denied', () => {
    const commands = buildVoicemailCommands({
      callControlId: 'cc-1',
      policy: { effectiveAction: POLICY_ACTION.DENY, reason: 'voicemail_disabled' },
    });
    expect(commands[0].commandType).toBe('REJECT');
  });
});
