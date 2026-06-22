const { resolveGreetingMessage } = require('./greeting');
const { isWithinBusinessHours } = require('./businessHours');
const { normalizePhoneNumber } = require('./phone');
const {
  normalizeRingGroupMembers,
  normalizeRingStrategy,
  clampRingTimeout,
} = require('./ringGroup');
const { clampVoicemailMaxLength } = require('./voicemail');
const {
  buildGreetingTexml,
  buildTenantGreetingTexml,
  buildAfterHoursTexml,
  buildAfterHoursVoicemailTexml,
  buildIvrGatherTexml,
  buildDialConnectTexml,
} = require('./texml');

const IVR_ACTIONS = new Set(['message', 'forward', 'ring_group']);

function normalizeIvrOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const action = IVR_ACTIONS.has(String(item.action || 'message').toLowerCase())
        ? String(item.action).toLowerCase()
        : 'message';
      return {
        digit: String(item.digit || '').trim(),
        label: String(item.label || '').trim(),
        action,
        message: String(item.message || '').trim(),
        forwardTo: normalizePhoneNumber(item.forwardTo || item.forwardNumber || ''),
      };
    })
    .filter((item) => item.digit && item.label);
}

function resolveRoutingMessage(template, tenantName) {
  if (!template?.trim()) return '';
  return resolveGreetingMessage(template, tenantName);
}

function getRingMembers(greeting) {
  return normalizeRingGroupMembers(greeting?.ringGroupMembers)
    .filter((item) => item.phone)
    .map((item) => ({ phone: item.phone, label: item.label }));
}

function resolveNoAnswerMessage(greeting, tenantName) {
  const template = greeting?.noAnswerMessage
    || 'Sorry, no one is available at {company} right now.';
  return resolveRoutingMessage(template, tenantName);
}

function resolveVoicemailPrompt(greeting, tenantName) {
  const template = greeting?.voicemailPrompt
    || 'Sorry we missed your call at {company}. Please leave a message after the beep.';
  return resolveRoutingMessage(template, tenantName);
}

function resolveCallRecordingNotice(greeting, tenantName) {
  const template = greeting?.callRecordingNotice
    || 'This call may be recorded for quality and training purposes.';
  return resolveRoutingMessage(template, tenantName);
}

function getVoicemailOptions(greeting, tenant) {
  const enabled = greeting?.voicemailEnabled !== false;
  return {
    voicemailEnabled: enabled,
    voicemailPrompt: resolveVoicemailPrompt(greeting, tenant.name),
    voicemailMaxLength: clampVoicemailMaxLength(greeting?.voicemailMaxLength),
  };
}

function getCallRecordingOptions(greeting, tenant) {
  return {
    callRecordingEnabled: greeting?.callRecordingEnabled !== false,
    callRecordingNoticePreview: resolveCallRecordingNotice(greeting, tenant.name),
  };
}

function buildConnectPreamble({ greeting, tenant, openHoursMessage }) {
  const segments = [];

  if (greeting?.playGreetingBeforeConnect !== false && openHoursMessage?.trim()) {
    segments.push(openHoursMessage.trim());
  }

  if (
    greeting?.callRecordingEnabled !== false
    && greeting?.playCallRecordingNotice !== false
  ) {
    segments.push(resolveCallRecordingNotice(greeting, tenant.name));
  }

  return segments.join(' ');
}

function buildDialResponse({
  greeting,
  tenant,
  callerId,
  numbers,
  sequential,
  openHoursMessage,
  voicemailRecordingActionUrl,
  callRecordingCallbackUrl,
}) {
  const timeout = clampRingTimeout(greeting?.ringTimeout);
  const preamble = buildConnectPreamble({ greeting, tenant, openHoursMessage });
  const vm = getVoicemailOptions(greeting, tenant);
  const recording = getCallRecordingOptions(greeting, tenant);

  return buildDialConnectTexml({
    numbers,
    callerId,
    timeout,
    sequential,
    preambleMessage: preamble || null,
    noAnswerMessage: resolveNoAnswerMessage(greeting, tenant.name),
    recordingActionUrl: voicemailRecordingActionUrl,
    callRecordingCallbackUrl,
    ...vm,
    ...recording,
  });
}

function buildForwardResponse({
  greeting,
  tenant,
  callerId,
  forwardNumber,
  openHoursMessage,
  voicemailRecordingActionUrl,
  callRecordingCallbackUrl,
}) {
  const number = normalizePhoneNumber(forwardNumber);
  if (!number) {
    return buildGreetingTexml('Call forward number is not configured.');
  }

  return buildDialResponse({
    greeting,
    tenant,
    callerId,
    numbers: [number],
    sequential: false,
    openHoursMessage,
    voicemailRecordingActionUrl,
    callRecordingCallbackUrl,
  });
}

function buildRingGroupResponse({
  greeting,
  tenant,
  callerId,
  openHoursMessage,
  voicemailRecordingActionUrl,
  callRecordingCallbackUrl,
}) {
  const members = getRingMembers(greeting);
  if (!members.length) {
    return buildGreetingTexml('Ring group has no members configured.');
  }

  return buildDialResponse({
    greeting,
    tenant,
    callerId,
    numbers: members.map((member) => member.phone),
    sequential: normalizeRingStrategy(greeting?.ringStrategy) === 'sequential',
    openHoursMessage,
    voicemailRecordingActionUrl,
    callRecordingCallbackUrl,
  });
}

function handleIvrSelection({
  greeting,
  tenant,
  payload,
  callerId,
  voicemailRecordingActionUrl,
  callRecordingCallbackUrl,
}) {
  const options = normalizeIvrOptions(greeting.ivrOptions);
  const selected = options.find((option) => option.digit === String(payload.Digits || payload.digits));
  if (!selected) {
    console.log('   ↳ IVR invalid digit:', payload.Digits || payload.digits);
    return buildGreetingTexml('Invalid selection. Goodbye.');
  }

  console.log(`   ↳ IVR selection: ${selected.digit} (${selected.label}) → ${selected.action}`);

  if (selected.action === 'forward' && selected.forwardTo) {
    return buildForwardResponse({
      greeting,
      tenant,
      callerId,
      forwardNumber: selected.forwardTo,
      openHoursMessage: null,
      voicemailRecordingActionUrl,
      callRecordingCallbackUrl,
    });
  }

  if (selected.action === 'ring_group' && greeting.ringGroupEnabled) {
    return buildRingGroupResponse({
      greeting,
      tenant,
      callerId,
      openHoursMessage: null,
      voicemailRecordingActionUrl,
      callRecordingCallbackUrl,
    });
  }

  const message = resolveRoutingMessage(
    selected.message || `You selected ${selected.label}.`,
    tenant.name,
  );
  return buildGreetingTexml(message);
}

function buildInboundCallTexml({
  tenant,
  greeting,
  payload,
  webhookUrl,
  voicemailRecordingActionUrl,
  callRecordingCallbackUrl,
}) {
  const timezone = tenant?.timezone || 'America/New_York';
  const digits = payload.Digits || payload.digits;
  const callerId = normalizePhoneNumber(payload.To || payload.to) || undefined;
  const openHoursMessage = resolveRoutingMessage(greeting?.message, tenant.name);
  const vm = getVoicemailOptions(greeting, tenant);

  if (digits && greeting?.ivrEnabled) {
    return handleIvrSelection({
      greeting,
      tenant,
      payload,
      callerId,
      voicemailRecordingActionUrl,
      callRecordingCallbackUrl,
    });
  }

  if (greeting?.businessHoursEnabled) {
    const open = isWithinBusinessHours(greeting.businessHours, timezone);
    if (!open) {
      const message = resolveRoutingMessage(
        greeting.afterHoursMessage
          || 'Thank you for calling {company}. We are currently closed.',
        tenant.name,
      );
      if (greeting.afterHoursVoicemailEnabled && vm.voicemailEnabled && voicemailRecordingActionUrl) {
        console.log('   ↳ After hours — voicemail');
        return buildAfterHoursVoicemailTexml({
          closedMessage: message,
          voicemailPrompt: vm.voicemailPrompt,
          recordingActionUrl: voicemailRecordingActionUrl,
          voicemailMaxLength: vm.voicemailMaxLength,
        });
      }
      console.log('   ↳ After hours — closed message');
      return buildAfterHoursTexml(message);
    }
  }

  const ivrOptions = normalizeIvrOptions(greeting?.ivrOptions);
  if (greeting?.ivrEnabled && ivrOptions.length) {
    const prompt = resolveRoutingMessage(
      greeting.ivrPrompt || 'Welcome to {company}.',
      tenant.name,
    );
    console.log('   ↳ IVR menu');
    return buildIvrGatherTexml({
      prompt,
      options: ivrOptions,
      actionUrl: webhookUrl,
      promptAudioUrl: greeting?.ivrPromptAudioUrl,
    });
  }

  if (greeting?.ringGroupEnabled && getRingMembers(greeting).length) {
    console.log('   ↳ Ring group');
    return buildRingGroupResponse({
      greeting,
      tenant,
      callerId,
      openHoursMessage,
      voicemailRecordingActionUrl,
      callRecordingCallbackUrl,
    });
  }

  if (greeting?.forwardEnabled && greeting.forwardNumber) {
    console.log('   ↳ Call forward');
    return buildForwardResponse({
      greeting,
      tenant,
      callerId,
      forwardNumber: greeting.forwardNumber,
      openHoursMessage,
      voicemailRecordingActionUrl,
      callRecordingCallbackUrl,
    });
  }

  console.log('   ↳ Standard greeting');
  return buildTenantGreetingTexml(tenant.name, greeting?.message, greeting?.greetingAudioUrl);
}

function mapCallRoutingResponse(greeting, tenant) {
  const message = greeting?.message ?? 'Welcome to {company}. Your call is connected.';
  return {
    tenantId: tenant.id,
    tenantName: tenant.name,
    timezone: tenant.timezone || 'America/New_York',
    message,
    preview: resolveGreetingMessage(message, tenant.name),
    voice: greeting?.voice ?? 'en-US',
    afterHoursMessage: greeting?.afterHoursMessage || '',
    afterHoursPreview: greeting?.afterHoursMessage
      ? resolveGreetingMessage(greeting.afterHoursMessage, tenant.name)
      : '',
    businessHoursEnabled: greeting?.businessHoursEnabled ?? false,
    businessHours: greeting?.businessHours || null,
    ivrEnabled: greeting?.ivrEnabled ?? false,
    ivrPrompt: greeting?.ivrPrompt || '',
    ivrOptions: normalizeIvrOptions(greeting?.ivrOptions),
    forwardEnabled: greeting?.forwardEnabled ?? false,
    forwardNumber: greeting?.forwardNumber || '',
    playGreetingBeforeConnect: greeting?.playGreetingBeforeConnect ?? true,
    ringGroupEnabled: greeting?.ringGroupEnabled ?? false,
    ringGroupName: greeting?.ringGroupName || '',
    ringGroupMembers: getRingMembers(greeting),
    ringStrategy: normalizeRingStrategy(greeting?.ringStrategy),
    ringTimeout: clampRingTimeout(greeting?.ringTimeout),
    noAnswerMessage: greeting?.noAnswerMessage || '',
    noAnswerPreview: greeting?.noAnswerMessage
      ? resolveGreetingMessage(greeting.noAnswerMessage, tenant.name)
      : '',
    voicemailEnabled: greeting?.voicemailEnabled ?? true,
    voicemailPrompt: greeting?.voicemailPrompt || '',
    voicemailPromptPreview: greeting?.voicemailPrompt
      ? resolveGreetingMessage(greeting.voicemailPrompt, tenant.name)
      : resolveVoicemailPrompt(greeting, tenant.name),
    voicemailMaxLength: clampVoicemailMaxLength(greeting?.voicemailMaxLength),
    afterHoursVoicemailEnabled: greeting?.afterHoursVoicemailEnabled ?? false,
    callRecordingEnabled: greeting?.callRecordingEnabled ?? true,
    callRecordingNotice: greeting?.callRecordingNotice || '',
    callRecordingNoticePreview: resolveCallRecordingNotice(greeting, tenant.name),
    playCallRecordingNotice: greeting?.playCallRecordingNotice ?? true,
    greetingAudioUrl: greeting?.greetingAudioUrl || '',
    ivrPromptAudioUrl: greeting?.ivrPromptAudioUrl || '',
  };
}

module.exports = {
  buildInboundCallTexml,
  mapCallRoutingResponse,
  normalizeIvrOptions,
};
