/**
 * Pre-connect media policy — separate from device ring strategy.
 *
 * Ring strategy (DESK_FIRST, SIMULTANEOUS, …) controls which devices ring and in what order.
 * Pre-connect media controls optional PSTN announcements before dialing agents.
 *
 * Extension-managed DIDs default to NONE so callers hear ringback, not tenant greetings.
 *
 * @see docs/vsp/pbx/09-extension-routing.md
 */

const { resolveEffectiveRoutingType } = require('./numberRouting');

const PRE_CONNECT_MEDIA_POLICY = Object.freeze({
  NONE: 'NONE',
  GREETING: 'GREETING',
  RECORDING_NOTICE: 'RECORDING_NOTICE',
  GREETING_AND_RECORDING: 'GREETING_AND_RECORDING',
  IVR: 'IVR',
});

function isExtensionManagedInbound(phoneRecord, routedExtension = null) {
  if (!phoneRecord) return false;
  if (phoneRecord.extensionId) return true;
  if (phoneRecord.routingType === 'direct_user' && routedExtension?.id) return true;
  return false;
}

function resolvePreConnectMediaPolicy({
  phoneRecord = null,
  greeting = {},
  routedExtension = null,
  ivrWouldRun = false,
} = {}) {
  if (isExtensionManagedInbound(phoneRecord, routedExtension)) {
    return PRE_CONNECT_MEDIA_POLICY.NONE;
  }

  if (ivrWouldRun) {
    return PRE_CONNECT_MEDIA_POLICY.IVR;
  }

  const effectiveRoutingType = resolveEffectiveRoutingType(phoneRecord, greeting);
  if (effectiveRoutingType === 'ivr') {
    return PRE_CONNECT_MEDIA_POLICY.IVR;
  }

  const wantsGreeting = greeting?.playGreetingBeforeConnect !== false;
  const wantsRecording = greeting?.playCallRecordingNotice !== false
    && greeting?.callRecordingEnabled !== false;

  if (wantsGreeting && wantsRecording) {
    return PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING;
  }
  if (wantsGreeting) {
    return PRE_CONNECT_MEDIA_POLICY.GREETING;
  }
  if (wantsRecording) {
    return PRE_CONNECT_MEDIA_POLICY.RECORDING_NOTICE;
  }
  return PRE_CONNECT_MEDIA_POLICY.NONE;
}

function policyRequiresPstnAnswer(policy) {
  return policy !== PRE_CONNECT_MEDIA_POLICY.NONE;
}

function policyPlaysGreeting(policy) {
  return policy === PRE_CONNECT_MEDIA_POLICY.GREETING
    || policy === PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING;
}

function policyPlaysRecordingNotice(policy) {
  return policy === PRE_CONNECT_MEDIA_POLICY.RECORDING_NOTICE
    || policy === PRE_CONNECT_MEDIA_POLICY.GREETING_AND_RECORDING;
}

module.exports = {
  PRE_CONNECT_MEDIA_POLICY,
  isExtensionManagedInbound,
  resolvePreConnectMediaPolicy,
  policyRequiresPstnAnswer,
  policyPlaysGreeting,
  policyPlaysRecordingNotice,
};
