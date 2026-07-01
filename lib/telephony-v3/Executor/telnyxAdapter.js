/**
 * Thin V3 → Telnyx Call Control adapter (Phase 3.1).
 * Delegates to lib/telnyxCallControl.js — no direct HTTP here.
 */

const defaultTelnyx = require('../../telnyxCallControl');
const { v3Logger } = require('../Utils/v3Logger');

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

/**
 * Redact sensitive fields from Telnyx request payloads before logging.
 * @param {Record<string, unknown>|null|undefined} payload
 */
function sanitizeTelnyxPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload ?? null;
  const sanitized = { ...payload };
  if ('client_state' in sanitized) sanitized.client_state = '[redacted]';
  if ('clientState' in sanitized) sanitized.clientState = '[redacted]';
  return sanitized;
}

/**
 * Structured INFO log for DIAL/BRIDGE command execution diagnostics.
 * @param {string} event
 * @param {Record<string, unknown>} fields
 */
function logDialBridgeDiagnostic(event, fields) {
  const record = {
    event,
    commandType: fields.commandType ?? null,
    destination: fields.destination ?? null,
    callControlId: fields.callControlId ?? null,
    targetLegId: fields.targetLegId ?? null,
    commandId: fields.commandId ?? null,
    telnyxEndpoint: fields.telnyxEndpoint ?? null,
    requestPayload: sanitizeTelnyxPayload(
      /** @type {Record<string, unknown>|null|undefined} */ (fields.requestPayload),
    ),
    responseStatus: fields.responseStatus ?? null,
    responseBody: fields.responseBody ?? null,
    exceptionStack: fields.exceptionStack ?? null,
    message: fields.message ?? null,
  };
  console.log(`[V3] dialBridge.${event}`, record);
  v3Logger.info(`dial_bridge.${event}`, record);
}

/**
 * @param {string} label
 * @param {Record<string, unknown>} details
 */
function logTelnyxApi(label, details) {
  console.log(`[V3] telnyxAdapter ${label}`, details);
  v3Logger.info(`telnyx.adapter.${label.replace(/\s+/g, '_').toLowerCase()}`, details);
}

/** @type {Set<string>} */
const SUPPORTED_TYPES = new Set([
  'BRIDGE',
  'HANGUP',
  'ANSWER',
  'REJECT',
  'SPEAK',
  'PLAY',
  'PLAY_AUDIO',
  'STOP_AUDIO',
  'RECORD_START',
  'START_RECORDING',
  'RECORD_STOP',
  'STOP_RECORDING',
  'START_VOICEMAIL',
  'STOP_VOICEMAIL',
  'PLAY_GREETING',
  'CREATE_CONFERENCE',
  'ADD_PARTICIPANT',
  'REMOVE_PARTICIPANT',
  'MUTE_PARTICIPANT',
  'UNMUTE_PARTICIPANT',
  'DESTROY_CONFERENCE',
  'HOLD',
  'UNHOLD',
  'TRANSFER',
  'ENQUEUE',
  'DEQUEUE',
  'DIAL',
  'GATHER',
]);

/**
 * @param {string} commandType
 */
function normalizeCommandType(commandType) {
  const upper = String(commandType || '').toUpperCase();
  switch (upper) {
    case 'PLAY_AUDIO':
      return 'PLAY';
    case 'STOP_AUDIO':
      return 'STOP_AUDIO';
    case 'START_RECORDING':
      return 'RECORD_START';
    case 'STOP_RECORDING':
      return 'RECORD_STOP';
    case 'START_VOICEMAIL':
      return 'VOICEMAIL_START';
    case 'STOP_VOICEMAIL':
      return 'VOICEMAIL_STOP';
    case 'PLAY_GREETING':
      return 'PLAY';
    case 'CREATE_CONFERENCE':
      return 'CONFERENCE_CREATE';
    case 'ADD_PARTICIPANT':
      return 'CONFERENCE_JOIN';
    case 'REMOVE_PARTICIPANT':
      return 'CONFERENCE_REMOVE';
    case 'MUTE_PARTICIPANT':
      return 'CONFERENCE_MUTE';
    case 'UNMUTE_PARTICIPANT':
      return 'CONFERENCE_UNMUTE';
    case 'DESTROY_CONFERENCE':
      return 'CONFERENCE_DESTROY';
    case 'ENQUEUE':
      return 'QUEUE_ENQUEUE';
    case 'DEQUEUE':
      return 'QUEUE_DEQUEUE';
    case 'DIAL':
      return 'DIAL';
    case 'GATHER':
      return 'GATHER';
    default:
      return upper;
  }
}

/**
 * @param {string} commandType
 */
function isSupportedCommandType(commandType) {
  return SUPPORTED_TYPES.has(String(commandType || '').toUpperCase());
}

/**
 * @param {unknown} result
 * @param {string} action
 */
function normalizeSuccess(result, action) {
  const telnyxRequestId = result?.id
    || result?.command_id
    || result?.call_control_id
    || null;

  return {
    ok: true,
    skipped: false,
    action,
    telnyxRequestId,
    telnyxResult: result ?? null,
  };
}

/**
 * @param {Error & { status?: number, telnyx?: unknown }} error
 */
function normalizeFailure(error) {
  return {
    ok: false,
    skipped: false,
    message: error?.message || 'Telnyx command failed',
    status: error?.status,
    telnyx: error?.telnyx ?? null,
  };
}

/**
 * @param {{
 *   commandType: string,
 *   callControlId?: string|null,
 *   payload?: Record<string, unknown>,
 *   commandId?: string,
 *   targetLegId?: string|null,
 *   telnyx?: typeof defaultTelnyx,
 * }} input
 */
async function executeCommand(input) {
  const telnyx = input.telnyx || defaultTelnyx;
  const rawType = input.commandType;
  const commandType = normalizeCommandType(rawType);

  if (!isSupportedCommandType(rawType)) {
    const skipped = {
      ok: true,
      skipped: true,
      reason: 'unsupported',
      commandType: rawType,
      action: null,
      telnyxRequestId: null,
      telnyxResult: null,
    };
    logTelnyxApi('skipped unsupported command', {
      commandType: rawType,
      commandId: input.commandId,
      callControlId: input.callControlId,
      skipReason: 'unsupported_command_type',
    });
    return skipped;
  }

  const payload = input.payload || {};
  const callControlId = input.callControlId || payload.callControlId || payload.targetCallControlId;

  if (!callControlId) {
    const err = Object.assign(new Error('callControlId is required for Telnyx command'), {
      status: 400,
      code: 'V3_VALIDATION',
    });
    throw err;
  }

  try {
    switch (commandType) {
      case 'ANSWER': {
        const clientState = payload.clientState || payload.client_state;
        const result = await telnyx.answerCall(callControlId, clientState);
        return normalizeSuccess(result, 'answer');
      }
      case 'HANGUP': {
        const result = await telnyx.hangupCall(callControlId);
        return normalizeSuccess(result, 'hangup');
      }
      case 'REJECT': {
        const body = {};
        if (payload.cause) body.cause = payload.cause;
        if (payload.clientState || payload.client_state) {
          body.client_state = payload.clientState || payload.client_state;
        }
        const result = await telnyx.callControlAction(callControlId, 'reject', body);
        return normalizeSuccess(result, 'reject');
      }
      case 'BRIDGE': {
        const otherCallControlId = payload.otherCallControlId
          || payload.other_call_control_id
          || payload.targetCallControlId;
        const bridgePath = `/calls/${encodeURIComponent(callControlId)}/actions/bridge`;
        const bridgeEndpoint = `${TELNYX_API_BASE}${bridgePath}`;
        const bridgeRequestBody = {
          call_control_id: otherCallControlId ? String(otherCallControlId) : null,
        };
        logDialBridgeDiagnostic('request', {
          commandType: 'BRIDGE',
          destination: otherCallControlId || (payload.pendingTargetLeg ? 'pending_target_leg' : null),
          callControlId,
          targetLegId: input.targetLegId ?? null,
          commandId: input.commandId ?? null,
          telnyxEndpoint: bridgeEndpoint,
          requestPayload: bridgeRequestBody,
        });
        if (!otherCallControlId) {
          const deferReason = payload.pendingTargetLeg || payload.stub
            ? 'pending_target_leg'
            : 'missing_other_call_control_id';
          if (deferReason === 'pending_target_leg') {
            logDialBridgeDiagnostic('deferred', {
              commandType: 'BRIDGE',
              destination: 'pending_target_leg',
              callControlId,
              targetLegId: input.targetLegId ?? null,
              commandId: input.commandId ?? null,
              telnyxEndpoint: bridgeEndpoint,
              message: 'Bridge deferred until target leg call_control_id is known',
            });
            return {
              ok: true,
              skipped: true,
              reason: deferReason,
              action: 'bridge',
              telnyxRequestId: null,
              telnyxResult: null,
            };
          }
          const validationError = Object.assign(
            new Error('otherCallControlId is required for BRIDGE'),
            { status: 400, code: 'V3_VALIDATION' },
          );
          logDialBridgeDiagnostic('validation_failed', {
            commandType: 'BRIDGE',
            destination: null,
            callControlId,
            targetLegId: input.targetLegId ?? null,
            commandId: input.commandId ?? null,
            telnyxEndpoint: bridgeEndpoint,
            requestPayload: bridgeRequestBody,
            responseStatus: 400,
            message: validationError.message,
            exceptionStack: validationError.stack ?? null,
          });
          throw validationError;
        }
        const result = await telnyx.bridgeCalls(callControlId, {
          otherCallControlId: String(otherCallControlId),
          clientState: payload.clientState || payload.client_state,
          commandId: input.commandId,
          parkAfterUnbridge: payload.parkAfterUnbridge,
          holdAfterUnbridge: payload.holdAfterUnbridge,
          preventDoubleBridge: payload.preventDoubleBridge,
          playRingtone: payload.playRingtone,
          muteDtmf: payload.muteDtmf,
        });
        logDialBridgeDiagnostic('response', {
          commandType: 'BRIDGE',
          destination: String(otherCallControlId),
          callControlId,
          targetLegId: input.targetLegId ?? null,
          commandId: input.commandId ?? null,
          telnyxEndpoint: bridgeEndpoint,
          requestPayload: bridgeRequestBody,
          responseStatus: 200,
          responseBody: result ?? null,
        });
        return normalizeSuccess(result, 'bridge');
      }
      case 'SPEAK': {
        const text = payload.text || payload.payload || payload.message;
        if (!text) {
          throw Object.assign(new Error('text is required for SPEAK'), {
            status: 400,
            code: 'V3_VALIDATION',
          });
        }
        const result = await telnyx.speakCall(
          callControlId,
          String(text),
          payload.clientState || payload.client_state,
        );
        return normalizeSuccess(result, 'speak');
      }
      case 'PLAY': {
        if (payload.text || payload.message) {
          const result = await telnyx.speakCall(
            callControlId,
            String(payload.text || payload.message),
            payload.clientState || payload.client_state,
          );
          return normalizeSuccess(result, 'speak');
        }
        const playBody = {
          ...(payload.audioUrl || payload.audio_url
            ? { audio_url: String(payload.audioUrl || payload.audio_url) }
            : {}),
          ...(payload.clientState || payload.client_state
            ? { client_state: payload.clientState || payload.client_state }
            : {}),
        };
        if (!playBody.audio_url) {
          throw Object.assign(new Error('audioUrl or text is required for PLAY'), {
            status: 400,
            code: 'V3_VALIDATION',
          });
        }
        const result = await telnyx.callControlAction(callControlId, 'playback_start', playBody);
        return normalizeSuccess(result, 'playback_start');
      }
      case 'STOP_AUDIO': {
        const result = await telnyx.callControlAction(callControlId, 'playback_stop', {});
        return normalizeSuccess(result, 'playback_stop');
      }
      case 'RECORD_START': {
        const result = await telnyx.startCallRecording(
          callControlId,
          payload.clientState || payload.client_state,
        );
        return normalizeSuccess(result, 'record_start');
      }
      case 'RECORD_STOP': {
        const result = await telnyx.callControlAction(callControlId, 'record_stop', {});
        return normalizeSuccess(result, 'record_stop');
      }
      case 'VOICEMAIL_START': {
        const maxLength = payload.maxLength ?? payload.max_length ?? 120;
        const result = await telnyx.startVoicemailRecording(callControlId, {
          maxLength,
          clientState: payload.clientState || payload.client_state,
        });
        return normalizeSuccess(result, 'voicemail_start');
      }
      case 'VOICEMAIL_STOP': {
        const result = await telnyx.callControlAction(callControlId, 'record_stop', {});
        return normalizeSuccess(result, 'voicemail_stop');
      }
      case 'CONFERENCE_CREATE':
      case 'CONFERENCE_JOIN': {
        const conferenceName = payload.conferenceName || payload.conference_name || payload.conferenceId;
        const result = await telnyx.joinConference(callControlId, {
          conferenceName,
          conferenceId: payload.conferenceId,
          startConferenceOnEnter: commandType === 'CONFERENCE_CREATE'
            || payload.startConferenceOnEnter === true,
          clientState: payload.clientState || payload.client_state,
        });
        return normalizeSuccess(result, commandType === 'CONFERENCE_CREATE' ? 'conference_create' : 'conference_join');
      }
      case 'CONFERENCE_REMOVE': {
        if (payload.force) {
          const result = await telnyx.hangupCall(callControlId);
          return normalizeSuccess(result, 'conference_remove_hangup');
        }
        const result = await telnyx.leaveConference(
          callControlId,
          payload.clientState || payload.client_state,
        );
        return normalizeSuccess(result, 'conference_leave');
      }
      case 'CONFERENCE_MUTE': {
        const result = await telnyx.muteCall(callControlId, payload.clientState || payload.client_state);
        return normalizeSuccess(result, 'conference_mute');
      }
      case 'CONFERENCE_UNMUTE': {
        const result = await telnyx.unmuteCall(callControlId, payload.clientState || payload.client_state);
        return normalizeSuccess(result, 'conference_unmute');
      }
      case 'CONFERENCE_DESTROY': {
        const result = await telnyx.leaveConference(
          callControlId,
          payload.clientState || payload.client_state,
        );
        return normalizeSuccess(result, 'conference_destroy');
      }
      case 'HOLD': {
        const result = await telnyx.holdCall(callControlId, payload.clientState || payload.client_state);
        return normalizeSuccess(result, 'hold');
      }
      case 'UNHOLD': {
        const result = await telnyx.unholdCall(callControlId, payload.clientState || payload.client_state);
        return normalizeSuccess(result, 'unhold');
      }
      case 'TRANSFER': {
        const to = payload.to || payload.target;
        if (!to) {
          throw Object.assign(new Error('to is required for TRANSFER'), {
            status: 400,
            code: 'V3_VALIDATION',
          });
        }
        const result = await telnyx.transferCall(callControlId, {
          to: String(to),
          from: payload.from,
          fromDisplayName: payload.fromDisplayName,
          clientState: payload.clientState || payload.client_state,
          timeoutSecs: payload.timeoutSecs,
        });
        return normalizeSuccess(result, 'transfer');
      }
      case 'QUEUE_ENQUEUE': {
        const result = await telnyx.holdCall(callControlId, payload.clientState || payload.client_state);
        return normalizeSuccess(result, 'queue_enqueue');
      }
      case 'QUEUE_DEQUEUE': {
        const result = await telnyx.unholdCall(callControlId, payload.clientState || payload.client_state);
        return normalizeSuccess(result, 'queue_dequeue');
      }
      case 'DIAL': {
        const to = payload.to || payload.target;
        const dialEndpoint = `${TELNYX_API_BASE}/calls`;
        const dialRequestBody = {
          to: to ? String(to) : null,
          from: payload.from ?? null,
          from_display_name: payload.fromDisplayName ?? null,
          connection_id: payload.connectionId ?? null,
          timeout_secs: payload.timeoutSecs ?? payload.timeout_secs ?? 25,
          link_to: callControlId,
          bridge_on_answer: true,
        };
        logDialBridgeDiagnostic('request', {
          commandType: 'DIAL',
          destination: to ? String(to) : null,
          callControlId,
          targetLegId: input.targetLegId ?? null,
          commandId: input.commandId ?? null,
          telnyxEndpoint: dialEndpoint,
          requestPayload: dialRequestBody,
        });
        if (!to) {
          const validationError = Object.assign(new Error('to is required for DIAL'), {
            status: 400,
            code: 'V3_VALIDATION',
          });
          logDialBridgeDiagnostic('validation_failed', {
            commandType: 'DIAL',
            destination: null,
            callControlId,
            targetLegId: input.targetLegId ?? null,
            commandId: input.commandId ?? null,
            telnyxEndpoint: dialEndpoint,
            requestPayload: dialRequestBody,
            responseStatus: 400,
            message: validationError.message,
            exceptionStack: validationError.stack ?? null,
          });
          throw validationError;
        }
        const result = await telnyx.dialDestination(callControlId, {
          to: String(to),
          from: payload.from,
          fromDisplayName: payload.fromDisplayName,
          connectionId: payload.connectionId,
          timeoutSecs: payload.timeoutSecs ?? payload.timeout_secs ?? 25,
          clientState: payload.clientState || payload.client_state,
        });
        logDialBridgeDiagnostic('response', {
          commandType: 'DIAL',
          destination: String(to),
          callControlId,
          targetLegId: input.targetLegId ?? null,
          commandId: input.commandId ?? null,
          telnyxEndpoint: dialEndpoint,
          requestPayload: dialRequestBody,
          responseStatus: 200,
          responseBody: result ?? null,
        });
        return normalizeSuccess(result, 'dial');
      }
      case 'GATHER': {
        const prompt = payload.prompt || payload.text || payload.message || 'Please enter a digit.';
        const result = await telnyx.gatherUsingSpeak(callControlId, {
          prompt: String(prompt),
          validDigits: payload.validDigits || payload.valid_digits || '0123456789*#',
          maximumDigits: payload.maxDigits ?? payload.maximum_digits ?? 1,
          timeoutMillis: (payload.timeoutSec ?? payload.timeout_secs ?? 5) * 1000,
          clientState: payload.clientState || payload.client_state,
        });
        return normalizeSuccess(result, 'gather');
      }
      default:
        return {
          ok: true,
          skipped: true,
          reason: 'unsupported',
          commandType: rawType,
          action: null,
          telnyxRequestId: null,
          telnyxResult: null,
        };
    }
  } catch (error) {
    const normalized = normalizeFailure(error);
    if (commandType === 'DIAL' || commandType === 'BRIDGE') {
      const payload = input.payload || {};
      const destination = commandType === 'DIAL'
        ? (payload.to || payload.target || null)
        : (payload.otherCallControlId
          || payload.other_call_control_id
          || payload.targetCallControlId
          || (payload.pendingTargetLeg ? 'pending_target_leg' : null));
      const telnyxEndpoint = commandType === 'DIAL'
        ? `${TELNYX_API_BASE}/calls`
        : `${TELNYX_API_BASE}/calls/${encodeURIComponent(callControlId || '')}/actions/bridge`;
      logDialBridgeDiagnostic('error', {
        commandType,
        destination,
        callControlId: callControlId ?? null,
        targetLegId: input.targetLegId ?? null,
        commandId: input.commandId ?? null,
        telnyxEndpoint,
        responseStatus: normalized.status ?? null,
        responseBody: normalized.telnyx ?? null,
        message: normalized.message,
        exceptionStack: error?.stack ?? null,
      });
    }
    const err = Object.assign(new Error(normalized.message), {
      status: normalized.status,
      telnyx: normalized.telnyx,
    });
    throw err;
  }
}

module.exports = {
  SUPPORTED_TYPES,
  normalizeCommandType,
  isSupportedCommandType,
  executeCommand,
  normalizeSuccess,
  normalizeFailure,
  logDialBridgeDiagnostic,
};
