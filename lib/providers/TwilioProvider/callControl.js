/**
 * TwilioProvider/callControl — TwiML + Calls REST resource call control.
 *
 * New code (Phase 7). Maps the same `V3CommandIntent` shape that
 * lib/telephony-v3/Executor/telnyxAdapter.js already consumes onto Twilio's
 * two call-control primitives:
 *   1. TwiML (webhook-returned XML) for the initial answer/greeting flow.
 *   2. Calls REST resource (`POST /Calls/{Sid}.json`) to redirect an
 *      *already in-progress* call to new TwiML, or to end it
 *      (`Status=completed`) — this is Twilio's equivalent of Telnyx's
 *      mid-call Call Control actions (speak/play/record/transfer/etc.).
 *
 * `callControlId` in every intent below is the Twilio Call Sid.
 *
 * Verified against live Twilio MCP docs (twilio-docs MCP server):
 *  - `<Dial>` verb attributes — `twilio__search` "TwiML Dial verb attributes
 *    callerId timeout record action" (source: docs) ->
 *    https://www.twilio.com/docs/voice/twiml/dial. Documented attributes
 *    used below: `action`, `method`, `callerId`, `timeout`, `timeLimit`,
 *    `record` (`do-not-record`|`record-from-answer`|`record-from-ringing`|
 *    `record-from-answer-dual`|`record-from-ringing-dual`), `answerOnBridge`.
 *  - `<Gather>` verb — `twilio__search` "TwiML Gather verb input speech
 *    dtmf action method" (source: docs) ->
 *    https://www.twilio.com/docs/voice/twiml/gather. `input` accepts a
 *    space-separated combination of `dtmf`/`speech` (defaults to `dtmf`
 *    only if omitted) — added below instead of always emitting DTMF-only
 *    Gather, so speech-capable IVR intents from telephony-v3 work on Twilio
 *    too.
 *  - Calls resource `Create`/`Update` — `twilio__search` "Create Call
 *    resource parameters Url Twiml StatusCallback MachineDetection"
 *    (source: api) -> op::twilio_api_v2010::CreateCall
 *    (POST /2010-04-01/Accounts/{AccountSid}/Calls.json) and
 *    op::twilio_api_v2010::UpdateCall
 *    (POST /2010-04-01/Accounts/{AccountSid}/Calls/{Sid}.json). Documented
 *    Create params used below: `To`, `From`, `Url`/`Twiml`, `Method`,
 *    `Record`, `StatusCallback`, `StatusCallbackEvent`, `MachineDetection`,
 *    `Timeout`. All new params are optional passthroughs — existing callers
 *    that only pass `to`/`from`/`voiceWebhookUrl` are unaffected (backward
 *    compatible).
 */

const { twilioApiRequest, getTwilioCredentials } = require('./twilioClient');

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * @param {string} commandType
 */
function normalizeCommandType(commandType) {
  const upper = String(commandType || '').toUpperCase();
  switch (upper) {
    case 'PLAY_AUDIO': return 'PLAY';
    case 'START_RECORDING': return 'RECORD_START';
    case 'STOP_RECORDING': return 'RECORD_STOP';
    case 'START_VOICEMAIL': return 'VOICEMAIL_START';
    case 'STOP_VOICEMAIL': return 'VOICEMAIL_STOP';
    case 'PLAY_GREETING': return 'PLAY';
    case 'CREATE_CONFERENCE': return 'CONFERENCE_CREATE';
    case 'ADD_PARTICIPANT': return 'CONFERENCE_JOIN';
    case 'REMOVE_PARTICIPANT': return 'CONFERENCE_REMOVE';
    case 'MUTE_PARTICIPANT': return 'CONFERENCE_MUTE';
    case 'UNMUTE_PARTICIPANT': return 'CONFERENCE_UNMUTE';
    case 'DESTROY_CONFERENCE': return 'CONFERENCE_DESTROY';
    case 'ENQUEUE': return 'QUEUE_ENQUEUE';
    case 'DEQUEUE': return 'QUEUE_DEQUEUE';
    default: return upper;
  }
}

/**
 * Builds a <Response> TwiML document for a given normalized command.
 * Returned as the webhook response body (initial leg) or as the `Twiml`
 * param on a REST update (mid-call redirect).
 * @param {string} commandType
 * @param {Record<string, unknown>} payload
 */
function buildTwiml(commandType, payload = {}) {
  const verbs = [];

  switch (commandType) {
    case 'SPEAK': {
      const text = payload.text || payload.message;
      verbs.push(`<Say>${escapeXml(text)}</Say>`);
      break;
    }
    case 'PLAY': {
      if (payload.text || payload.message) {
        verbs.push(`<Say>${escapeXml(payload.text || payload.message)}</Say>`);
      } else {
        verbs.push(`<Play>${escapeXml(payload.audioUrl || payload.audio_url)}</Play>`);
      }
      break;
    }
    case 'RECORD_START': {
      const attrs = [
        'recordingStatusCallbackEvent="in-progress completed"',
        payload.recordingStatusCallbackUrl ? `recordingStatusCallback="${escapeXml(payload.recordingStatusCallbackUrl)}"` : '',
        payload.maxLength ? `maxLength="${Number(payload.maxLength)}"` : '',
      ].filter(Boolean).join(' ');
      verbs.push(`<Record ${attrs} />`);
      break;
    }
    case 'VOICEMAIL_START': {
      verbs.push(`<Record maxLength="${Number(payload.maxLength || 120)}" playBeep="true" />`);
      break;
    }
    case 'HANGUP':
    case 'REJECT': {
      verbs.push('<Hangup/>');
      break;
    }
    case 'DIAL':
    case 'BRIDGE':
    case 'TRANSFER': {
      const to = payload.to || payload.target || payload.otherCallControlId;
      const attrs = [
        payload.from ? `callerId="${escapeXml(payload.from)}"` : '',
        payload.timeoutSecs ? `timeout="${Number(payload.timeoutSecs)}"` : '',
        payload.timeLimitSecs ? `timeLimit="${Number(payload.timeLimitSecs)}"` : '',
        payload.actionUrl ? `action="${escapeXml(payload.actionUrl)}"` : '',
        payload.method ? `method="${escapeXml(payload.method)}"` : '',
        payload.record ? `record="${escapeXml(payload.record)}"` : '',
        payload.recordingStatusCallbackUrl ? `recordingStatusCallback="${escapeXml(payload.recordingStatusCallbackUrl)}"` : '',
        payload.answerOnBridge !== undefined ? `answerOnBridge="${Boolean(payload.answerOnBridge)}"` : '',
      ].filter(Boolean).join(' ');
      verbs.push(`<Dial${attrs ? ` ${attrs}` : ''}>${escapeXml(to)}</Dial>`);
      break;
    }
    case 'GATHER': {
      const numDigits = payload.numDigits ? ` numDigits="${Number(payload.numDigits)}"` : '';
      const timeout = payload.timeoutSecs ? ` timeout="${Number(payload.timeoutSecs)}"` : '';
      const action = payload.actionUrl ? ` action="${escapeXml(payload.actionUrl)}"` : '';
      const method = payload.method ? ` method="${escapeXml(payload.method)}"` : '';
      // Twilio defaults <Gather input> to "dtmf" only; pass through
      // "speech", "dtmf", or "speech dtmf" so telephony-v3 speech-IVR
      // intents aren't silently downgraded to keypad-only on Twilio.
      const input = payload.input ? ` input="${escapeXml(payload.input)}"` : '';
      const prompt = payload.text ? `<Say>${escapeXml(payload.text)}</Say>` : '';
      verbs.push(`<Gather${numDigits}${timeout}${action}${method}${input}>${prompt}</Gather>`);
      break;
    }
    case 'CONFERENCE_CREATE':
    case 'CONFERENCE_JOIN': {
      const conferenceName = payload.conferenceName || payload.conference_name || payload.conferenceId;
      verbs.push(`<Dial><Conference startConferenceOnEnter="${commandType === 'CONFERENCE_CREATE'}" endConferenceOnExit="false">${escapeXml(conferenceName)}</Conference></Dial>`);
      break;
    }
    case 'QUEUE_ENQUEUE': {
      const queueName = payload.queueName || payload.queue_name || 'default';
      verbs.push(`<Enqueue>${escapeXml(queueName)}</Enqueue>`);
      break;
    }
    case 'HOLD': {
      verbs.push('<Play loop="0">https://com.twilio.music.classical.s3.amazonaws.com/BusyStrings.mp3</Play>');
      break;
    }
    default:
      break;
  }

  return `<?xml version="1.0" encoding="UTF-8"?><Response>${verbs.join('')}</Response>`;
}

/**
 * Mid-call actions on an already-answered leg: redirect the live call to
 * new TwiML (or end it) via the Calls REST resource.
 * @param {string} callSid
 * @param {string} twiml
 * @param {{ tenantId?: string }} [options]
 */
async function redirectCall(callSid, twiml, options = {}) {
  const credentials = await getTwilioCredentials(options.tenantId);
  return twilioApiRequest('post', `/Calls/${callSid}.json`, { Twiml: twiml }, credentials);
}

/**
 * @param {string} callSid
 * @param {{ tenantId?: string }} [options]
 */
async function hangupCall(callSid, options = {}) {
  const credentials = await getTwilioCredentials(options.tenantId);
  return twilioApiRequest('post', `/Calls/${callSid}.json`, { Status: 'completed' }, credentials);
}

/**
 * @param {{ conferenceSid: string, callSid: string, muted?: boolean, hold?: boolean }} input
 */
async function updateConferenceParticipant(input) {
  const credentials = await getTwilioCredentials(input.tenantId);
  const data = {};
  if (input.muted !== undefined) data.Muted = String(Boolean(input.muted));
  if (input.hold !== undefined) data.Hold = String(Boolean(input.hold));
  return twilioApiRequest(
    'post',
    `/Conferences/${input.conferenceSid}/Participants/${input.callSid}.json`,
    data,
    credentials,
  );
}

/**
 * Originates a new outbound call (Twilio analog of Telnyx `dialDestination`).
 * `twiml` is an alternative to `voiceWebhookUrl` — Twilio's Create Call
 * resource accepts either `Url` (Twilio requests TwiML from your server) or
 * `Twiml` (inline TwiML, no callback needed) per op::twilio_api_v2010::CreateCall.
 * @param {{
 *   to: string,
 *   from: string,
 *   tenantId?: string,
 *   voiceWebhookUrl?: string,
 *   twiml?: string,
 *   record?: boolean|string,
 *   statusCallbackUrl?: string,
 *   statusCallbackEvents?: string[],
 *   machineDetection?: 'Enable'|'DetectMessageEnd',
 *   timeoutSecs?: number,
 * }} input
 */
async function createCall(input) {
  const credentials = await getTwilioCredentials(input.tenantId);
  return twilioApiRequest('post', '/Calls.json', {
    To: input.to,
    From: input.from,
    ...(input.twiml ? { Twiml: input.twiml } : { Url: input.voiceWebhookUrl, Method: 'POST' }),
    ...(input.record !== undefined ? { Record: String(input.record) } : {}),
    ...(input.statusCallbackUrl ? {
      StatusCallback: input.statusCallbackUrl,
      StatusCallbackMethod: 'POST',
      StatusCallbackEvent: (input.statusCallbackEvents || ['initiated', 'ringing', 'answered', 'completed']).join(' '),
    } : {}),
    ...(input.machineDetection ? { MachineDetection: input.machineDetection } : {}),
    ...(input.timeoutSecs ? { Timeout: Number(input.timeoutSecs) } : {}),
  }, credentials);
}

/**
 * Generic call-control dispatch, mirroring
 * lib/telephony-v3/Executor/telnyxAdapter.js#executeCommand's shape.
 * @param {{ commandType: string, callControlId?: string, payload?: Record<string, unknown>, tenantId?: string }} input
 */
async function executeCommand(input) {
  const commandType = normalizeCommandType(input.commandType);
  const payload = input.payload || {};
  const callSid = input.callControlId;

  if (!callSid && commandType !== 'DIAL') {
    throw Object.assign(new Error('callControlId (Twilio Call Sid) is required'), { status: 400, code: 'V3_VALIDATION' });
  }

  switch (commandType) {
    case 'ANSWER': {
      // Twilio answers a call implicitly by returning TwiML from the voice
      // webhook — there is no separate "answer" REST action like Telnyx's.
      return { ok: true, skipped: true, reason: 'answered_via_webhook_response', action: 'answer', telnyxRequestId: null, telnyxResult: null };
    }
    case 'DIAL': {
      const result = await createCall({
        to: payload.to || payload.target,
        from: payload.from,
        tenantId: input.tenantId,
        voiceWebhookUrl: payload.voiceWebhookUrl,
        twiml: payload.twiml,
        record: payload.record,
        statusCallbackUrl: payload.statusCallbackUrl,
        statusCallbackEvents: payload.statusCallbackEvents,
        machineDetection: payload.machineDetection,
        timeoutSecs: payload.timeoutSecs,
      });
      return { ok: true, skipped: false, action: 'dial', telnyxRequestId: result.sid, telnyxResult: result };
    }
    case 'HANGUP': {
      const result = await hangupCall(callSid, { tenantId: input.tenantId });
      return { ok: true, skipped: false, action: 'hangup', telnyxRequestId: result.sid, telnyxResult: result };
    }
    case 'CONFERENCE_MUTE':
    case 'CONFERENCE_UNMUTE': {
      const result = await updateConferenceParticipant({
        conferenceSid: payload.conferenceId || payload.conferenceSid,
        callSid,
        muted: commandType === 'CONFERENCE_MUTE',
        tenantId: input.tenantId,
      });
      return { ok: true, skipped: false, action: commandType.toLowerCase(), telnyxRequestId: result.call_sid, telnyxResult: result };
    }
    case 'HOLD':
    case 'UNHOLD': {
      if (payload.conferenceId || payload.conferenceSid) {
        const result = await updateConferenceParticipant({
          conferenceSid: payload.conferenceId || payload.conferenceSid,
          callSid,
          hold: commandType === 'HOLD',
          tenantId: input.tenantId,
        });
        return { ok: true, skipped: false, action: commandType.toLowerCase(), telnyxRequestId: result.call_sid, telnyxResult: result };
      }
      const twiml = commandType === 'HOLD' ? buildTwiml('HOLD', payload) : buildTwiml('GATHER', {});
      const result = await redirectCall(callSid, twiml, { tenantId: input.tenantId });
      return { ok: true, skipped: false, action: commandType.toLowerCase(), telnyxRequestId: result.sid, telnyxResult: result };
    }
    default: {
      // Everything else (SPEAK/PLAY/RECORD_*/TRANSFER/GATHER/CONFERENCE_CREATE|JOIN/QUEUE_ENQUEUE/...)
      // is expressed by redirecting the live call to freshly-built TwiML.
      const twiml = buildTwiml(commandType, payload);
      const result = await redirectCall(callSid, twiml, { tenantId: input.tenantId });
      return { ok: true, skipped: false, action: commandType.toLowerCase(), telnyxRequestId: result.sid, telnyxResult: result };
    }
  }
}

module.exports = {
  normalizeCommandType,
  buildTwiml,
  redirectCall,
  hangupCall,
  updateConferenceParticipant,
  createCall,
  executeCommand,
};
