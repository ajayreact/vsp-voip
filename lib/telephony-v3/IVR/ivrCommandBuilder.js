const { POLICY_ACTION } = require('./ivrPolicy');
const { IVR_ACTION, DESTINATION_TYPE } = require('./ivrConstants');

/**
 * @param {{
 *   action: string,
 *   policy: { effectiveAction: string, reason?: string },
 *   callControlId: string,
 *   menuNode?: Record<string, unknown>|null,
 *   destination?: Record<string, unknown>|null,
 *   resolvedTarget?: Record<string, unknown>|null,
 *   connectionId?: string|null,
 * }} input
 * @returns {import('../types').V3CommandIntent[]}
 */
function buildIvrCommands(input) {
  if (input.policy?.effectiveAction === POLICY_ACTION.DENY && input.action !== IVR_ACTION.ROUTE) {
    return [{
      commandType: 'REJECT',
      reason: 'ivr_policy_deny',
      payload: { phase: 3.9, policyReason: input.policy.reason || 'denied' },
    }];
  }

  switch (input.action) {
    case IVR_ACTION.START:
    case IVR_ACTION.REPEAT:
    case IVR_ACTION.RETRY: {
      const commands = [];
      const greeting = input.menuNode?.greeting;
      if (greeting?.audioUrl) {
        commands.push({
          commandType: 'PLAY_GREETING',
          reason: 'ivr_greeting',
          payload: {
            phase: 3.9,
            callControlId: input.callControlId,
            audioUrl: greeting.audioUrl,
          },
        });
      } else if (greeting?.text) {
        commands.push({
          commandType: 'PLAY_GREETING',
          reason: 'ivr_greeting_speak',
          payload: { phase: 3.9, callControlId: input.callControlId, text: greeting.text },
        });
      }
      commands.push({
        commandType: 'GATHER',
        reason: 'ivr_gather',
        payload: {
          phase: 3.9,
          callControlId: input.callControlId,
          prompt: greeting?.text || 'Please enter your selection.',
          timeoutSec: input.menuNode?.timeoutSec ?? 5,
          maxDigits: input.menuNode?.maxDigits ?? 1,
          validDigits: input.menuNode?.validDigits || '0123456789*#',
        },
      });
      return commands;
    }

    case IVR_ACTION.TIMEOUT:
    case IVR_ACTION.INPUT: {
      if (input.policy?.operatorFallback) {
        return buildRouteCommands(DESTINATION_TYPE.OPERATOR, input);
      }
      const prompt = input.action === IVR_ACTION.TIMEOUT
        ? input.menuNode?.timeoutPrompt
        : input.menuNode?.invalidPrompt;
      const commands = [];
      if (prompt?.text || prompt?.audioUrl) {
        commands.push({
          commandType: 'PLAY_GREETING',
          reason: input.action === IVR_ACTION.TIMEOUT ? 'ivr_timeout_prompt' : 'ivr_invalid_prompt',
          payload: {
            phase: 3.9,
            callControlId: input.callControlId,
            text: prompt.text,
            audioUrl: prompt.audioUrl,
          },
        });
      }
      commands.push({
        commandType: 'GATHER',
        reason: 'ivr_gather_retry',
        payload: {
          phase: 3.9,
          callControlId: input.callControlId,
          prompt: prompt?.text || 'Please try again.',
          timeoutSec: input.menuNode?.timeoutSec ?? 5,
          maxDigits: 1,
        },
      });
      return commands;
    }

    case IVR_ACTION.ROUTE:
    case IVR_ACTION.EXIT:
      return buildRouteCommands(
        input.destination?.destination || input.resolvedTarget?.type,
        input,
      );

    default:
      return [{
        commandType: 'REJECT',
        reason: 'ivr_unknown_action',
        payload: { phase: 3.9, action: input.action },
      }];
  }
}

/**
 * @param {string} type
 * @param {object} input
 */
function buildRouteCommands(type, input) {
  const destType = String(type || '').toUpperCase();
  const target = input.resolvedTarget || {};
  const callControlId = input.callControlId;

  switch (destType) {
    case DESTINATION_TYPE.EXTENSION:
    case DESTINATION_TYPE.OPERATOR:
      return [
        {
          commandType: 'DIAL',
          reason: 'ivr_route_extension',
          payload: {
            phase: 3.9,
            to: target.dialTo,
            connectionId: input.connectionId,
            extensionId: target.extensionId,
          },
        },
        {
          commandType: 'BRIDGE',
          reason: 'ivr_route_bridge',
          payload: {
            phase: 3.9,
            callControlId,
            pendingTargetLeg: true,
            extensionId: target.extensionId,
          },
        },
      ];

    case DESTINATION_TYPE.RING_GROUP:
      return (target.dialTargets || []).map((to) => ({
        commandType: 'DIAL',
        reason: 'ivr_route_ring_group',
        payload: {
          phase: 3.9,
          to,
          connectionId: input.connectionId,
          ringGroupId: target.ringGroupId,
        },
      }));

    case DESTINATION_TYPE.VOICEMAIL:
      return [{
        commandType: 'START_VOICEMAIL',
        reason: 'ivr_route_voicemail',
        payload: {
          phase: 3.9,
          callControlId,
          extensionId: target.extensionId,
          mailboxId: target.mailboxId,
        },
      }];

    case DESTINATION_TYPE.QUEUE:
      return [{
        commandType: 'ENQUEUE',
        reason: 'ivr_route_queue',
        payload: {
          phase: 3.9,
          callControlId,
          queueId: target.queueId,
          ringGroupId: target.ringGroupId,
        },
      }];

    case DESTINATION_TYPE.CONFERENCE:
      return [{
        commandType: 'CREATE_CONFERENCE',
        reason: 'ivr_route_conference',
        payload: {
          phase: 3.9,
          callControlId,
          conferenceId: target.conferenceId,
        },
      }];

    case DESTINATION_TYPE.DISCONNECT:
      return [{
        commandType: 'HANGUP',
        reason: 'ivr_disconnect',
        payload: { phase: 3.9, callControlId },
      }];

    case DESTINATION_TYPE.REPEAT:
      return buildIvrCommands({
        ...input,
        action: IVR_ACTION.REPEAT,
        policy: { effectiveAction: POLICY_ACTION.ALLOW },
      });

    default:
      return [{
        commandType: 'HANGUP',
        reason: 'ivr_route_unknown',
        payload: { phase: 3.9, callControlId },
      }];
  }
}

module.exports = {
  buildIvrCommands,
};
