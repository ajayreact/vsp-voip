const { POLICY_ACTION } = require('./voicemailPolicy');
const { VOICEMAIL_ACTION } = require('./voicemailConstants');

/**
 * @param {{
 *   callControlId: string,
 *   policy: {
 *     effectiveAction: string,
 *     reason?: string,
 *     greetingUrl?: string|null,
 *     maxLength?: number,
 *     voicemailTimeoutSec?: number,
 *   },
 *   action?: string,
 *   greetingText?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildVoicemailCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY) {
    return [{
      commandType: 'REJECT',
      reason: 'voicemail_policy_deny',
      payload: { phase: 3.6, policyReason: input.policy.reason || 'denied' },
    }];
  }

  if (input.action === VOICEMAIL_ACTION.STOP) {
    return [{
      commandType: 'STOP_VOICEMAIL',
      reason: 'voicemail_stop',
      payload: {
        phase: 3.6,
        callControlId: input.callControlId,
      },
    }];
  }

  if (input.action === VOICEMAIL_ACTION.COMPLETE) {
    return [{
      commandType: 'HANGUP',
      reason: 'voicemail_complete_teardown',
      payload: {
        phase: 3.6,
        callControlId: input.callControlId,
        note: 'Voicemail saved; leg teardown',
      },
    }];
  }

  const commands = [];

  if (input.policy.greetingUrl) {
    commands.push({
      commandType: 'PLAY_GREETING',
      reason: 'voicemail_greeting',
      payload: {
        phase: 3.6,
        callControlId: input.callControlId,
        audioUrl: input.policy.greetingUrl,
      },
    });
  } else if (input.greetingText) {
    commands.push({
      commandType: 'PLAY_GREETING',
      reason: 'voicemail_greeting_speak',
      payload: {
        phase: 3.6,
        callControlId: input.callControlId,
        text: input.greetingText,
      },
    });
  }

  commands.push({
    commandType: 'START_VOICEMAIL',
    reason: 'voicemail_record_start',
    payload: {
      phase: 3.6,
      callControlId: input.callControlId,
      maxLength: input.policy.maxLength ?? 120,
      timeoutSecs: input.policy.voicemailTimeoutSec ?? 120,
    },
  });

  return commands;
}

module.exports = {
  buildVoicemailCommands,
};
