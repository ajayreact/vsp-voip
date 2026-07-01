const { POLICY_ACTION } = require('./conferencePolicy');
const { CONFERENCE_ACTION } = require('./conferenceConstants');

/**
 * @param {{
 *   action: string,
 *   policy: { effectiveAction: string, reason?: string },
 *   callControlId: string,
 *   conferenceId?: string|null,
 *   conferenceName?: string|null,
 *   otherCallControlId?: string|null,
 *   participantCallControlId?: string|null,
 *   startConferenceOnEnter?: boolean,
 *   legId?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildConferenceCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY) {
    return [{
      commandType: 'REJECT',
      reason: 'conference_policy_deny',
      payload: { phase: 3.7, policyReason: input.policy.reason || 'denied' },
    }];
  }

  switch (input.action) {
    case CONFERENCE_ACTION.CREATE:
      return [{
        commandType: 'CREATE_CONFERENCE',
        reason: 'conference_create',
        payload: {
          phase: 3.7,
          callControlId: input.callControlId,
          conferenceId: input.conferenceId,
          conferenceName: input.conferenceName,
          startConferenceOnEnter: true,
          legId: input.legId || null,
        },
      }];

    case CONFERENCE_ACTION.JOIN:
      return [{
        commandType: 'ADD_PARTICIPANT',
        reason: 'conference_join',
        payload: {
          phase: 3.7,
          callControlId: input.participantCallControlId || input.callControlId,
          conferenceId: input.conferenceId,
          conferenceName: input.conferenceName,
          legId: input.legId || null,
        },
      }];

    case CONFERENCE_ACTION.LEAVE:
      return [{
        commandType: 'REMOVE_PARTICIPANT',
        reason: 'conference_leave',
        payload: {
          phase: 3.7,
          callControlId: input.participantCallControlId || input.callControlId,
          conferenceId: input.conferenceId,
          softLeave: true,
        },
      }];

    case CONFERENCE_ACTION.REMOVE:
      return [{
        commandType: 'REMOVE_PARTICIPANT',
        reason: 'conference_remove',
        payload: {
          phase: 3.7,
          callControlId: input.participantCallControlId || input.callControlId,
          conferenceId: input.conferenceId,
          force: true,
        },
      }];

    case CONFERENCE_ACTION.MUTE:
      return [{
        commandType: 'MUTE_PARTICIPANT',
        reason: 'conference_mute',
        payload: {
          phase: 3.7,
          callControlId: input.participantCallControlId || input.callControlId,
          conferenceId: input.conferenceId,
        },
      }];

    case CONFERENCE_ACTION.UNMUTE:
      return [{
        commandType: 'UNMUTE_PARTICIPANT',
        reason: 'conference_unmute',
        payload: {
          phase: 3.7,
          callControlId: input.participantCallControlId || input.callControlId,
          conferenceId: input.conferenceId,
        },
      }];

    case CONFERENCE_ACTION.DESTROY:
    case CONFERENCE_ACTION.CLEANUP:
      return [{
        commandType: 'DESTROY_CONFERENCE',
        reason: 'conference_destroy',
        payload: {
          phase: 3.7,
          conferenceId: input.conferenceId,
          conferenceName: input.conferenceName,
          callControlId: input.callControlId,
        },
      }];

    case CONFERENCE_ACTION.MERGE:
      return [
        {
          commandType: 'BRIDGE',
          reason: 'conference_merge_bridge',
          payload: {
            phase: 3.7,
            callControlId: input.callControlId,
            otherCallControlId: input.otherCallControlId,
          },
        },
        {
          commandType: 'ADD_PARTICIPANT',
          reason: 'conference_merge_join',
          payload: {
            phase: 3.7,
            callControlId: input.otherCallControlId,
            conferenceId: input.conferenceId,
            conferenceName: input.conferenceName,
          },
        },
      ];

    case CONFERENCE_ACTION.START_RECORDING:
      return [{
        commandType: 'START_RECORDING',
        reason: 'conference_recording_start',
        payload: {
          phase: 3.7,
          callControlId: input.callControlId,
          conferenceId: input.conferenceId,
          scope: 'conference',
        },
      }];

    case CONFERENCE_ACTION.STOP_RECORDING:
      return [{
        commandType: 'STOP_RECORDING',
        reason: 'conference_recording_stop',
        payload: {
          phase: 3.7,
          callControlId: input.callControlId,
          conferenceId: input.conferenceId,
          scope: 'conference',
        },
      }];

    default:
      return [{
        commandType: 'REJECT',
        reason: 'conference_unknown_action',
        payload: { phase: 3.7, action: input.action },
      }];
  }
}

module.exports = {
  buildConferenceCommands,
};
