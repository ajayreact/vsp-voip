function escapeXml(text) {

  return String(text)

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&apos;');

}



function buildGreetingTexml(message, audioUrl) {
  const media = audioUrl?.trim()
    ? `<Play>${escapeXml(audioUrl.trim())}</Play>`
    : `<Say language="en-US">${escapeXml(message)}</Say>`;

  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  <Pause length="2"/>

  ${media}

  <Pause length="60"/>

</Response>`;

}



function buildAfterHoursTexml(message) {

  const safeMessage = escapeXml(message);

  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  <Pause length="1"/>

  <Say language="en-US">${safeMessage}</Say>

  <Hangup/>

</Response>`;

}

function buildSayAndHangupTexml(message) {
  const safeMessage = escapeXml(message);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-US">${safeMessage}</Say>
  <Hangup/>
</Response>`;
}



function buildIvrGatherTexml({ prompt, options, actionUrl, promptAudioUrl }) {
  const menuText = options.map((option) => `Press ${option.digit} for ${option.label}.`).join(' ');
  const spoken = `${prompt} ${menuText}`.trim();
  const gatherBody = promptAudioUrl?.trim()
    ? `<Play>${escapeXml(promptAudioUrl.trim())}</Play>`
    : `<Say language="en-US">${escapeXml(spoken)}</Say>`;
  const safeAction = escapeXml(actionUrl);

  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  <Gather numDigits="1" action="${safeAction}" method="POST" timeout="10">

    ${gatherBody}

  </Gather>

  <Say language="en-US">We did not receive your selection. Goodbye.</Say>

  <Hangup/>

</Response>`;

}



function buildTenantGreetingTexml(tenantName, customMessage, audioUrl) {
  const shortName = tenantName.replace(/\s+Inc\.?$/i, '').trim() || tenantName;
  const message =
    customMessage && String(customMessage).trim()
      ? String(customMessage)
          .replace(/\{company\}/gi, shortName)
          .replace(/\{tenant\}/gi, tenantName)
          .trim()
      : `Welcome to ${shortName}. Your call is connected.`;
  return buildGreetingTexml(message, audioUrl);
}



function buildNoAnswerTailTexml(message) {

  const fallback = message?.trim()

    ? escapeXml(message)

    : 'Sorry, no one is available to take your call. Goodbye.';

  return `

  <Say language="en-US">${fallback}</Say>

  <Hangup/>`;

}



function buildVoicemailRecordTexml({

  promptMessage,

  recordingActionUrl,

  maxLength = 120,

}) {

  const safePrompt = escapeXml(

    promptMessage?.trim()

      || 'Sorry we missed your call. Please leave a message after the beep.',

  );

  const safeAction = escapeXml(recordingActionUrl);

  const length = Math.min(Math.max(Number(maxLength) || 120, 30), 600);



  return `

  <Say language="en-US">${safePrompt}</Say>

  <Record maxLength="${length}" playBeep="true" action="${safeAction}" method="POST" finishOnKey="#"/>`;

}



function buildAfterAnswerTailTexml({

  noAnswerMessage,

  voicemailEnabled,

  voicemailPrompt,

  recordingActionUrl,

  voicemailMaxLength,

}) {

  if (voicemailEnabled && recordingActionUrl) {

    return buildVoicemailRecordTexml({

      promptMessage: voicemailPrompt || noAnswerMessage,

      recordingActionUrl,

      maxLength: voicemailMaxLength,

    });

  }

  return buildNoAnswerTailTexml(noAnswerMessage);

}



function buildAfterHoursVoicemailTexml({

  closedMessage,

  voicemailPrompt,

  recordingActionUrl,

  voicemailMaxLength,

}) {

  const closed = closedMessage?.trim()

    ? escapeXml(closedMessage)

    : 'We are currently closed.';

  const vmPrompt = voicemailPrompt?.trim()

    ? escapeXml(voicemailPrompt)

    : 'Please leave a message after the beep.';

  const safeAction = escapeXml(recordingActionUrl);

  const length = Math.min(Math.max(Number(voicemailMaxLength) || 120, 30), 600);



  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

  <Pause length="1"/>

  <Say language="en-US">${closed}</Say>

  <Say language="en-US">${vmPrompt}</Say>

  <Record maxLength="${length}" playBeep="true" action="${safeAction}" method="POST" finishOnKey="#"/>

</Response>`;

}



function buildDialConnectTexml({

  numbers,

  callerId,

  timeout = 25,

  sequential = false,

  preambleMessage,

  noAnswerMessage,

  voicemailEnabled = false,

  voicemailPrompt,

  recordingActionUrl,

  voicemailMaxLength = 120,

  callRecordingEnabled = false,

  callRecordingCallbackUrl,

}) {

  const destinations = (numbers || []).filter(Boolean);

  if (!destinations.length) {

    return buildGreetingTexml(noAnswerMessage || 'No destination configured.');

  }



  const safeCallerId = callerId ? escapeXml(callerId) : '';

  const callerAttr = safeCallerId ? ` callerId="${safeCallerId}"` : '';

  const sequentialAttr = sequential ? ' sequential="true"' : '';

  const recordingAttrs = callRecordingEnabled && callRecordingCallbackUrl

    ? ` record="record-from-answer-dual" recordingStatusCallback="${escapeXml(callRecordingCallbackUrl)}" recordingStatusCallbackMethod="POST" recordingStatusCallbackEvent="completed"`

    : '';

  const numberNodes = destinations

    .map((number) => `    <Number>${escapeXml(number)}</Number>`)

    .join('\n');



  const preamble = preambleMessage?.trim()

    ? `  <Say language="en-US">${escapeXml(preambleMessage)}</Say>\n`

    : '';



  const tail = buildAfterAnswerTailTexml({

    noAnswerMessage,

    voicemailEnabled,

    voicemailPrompt,

    recordingActionUrl,

    voicemailMaxLength,

  });



  return `<?xml version="1.0" encoding="UTF-8"?>

<Response>

${preamble}  <Dial timeout="${timeout}"${callerAttr}${sequentialAttr}${recordingAttrs}>

${numberNodes}

  </Dial>${tail}

</Response>`;

}



module.exports = {

  buildGreetingTexml,

  buildTenantGreetingTexml,

  buildAfterHoursTexml,

  buildSayAndHangupTexml,

  buildIvrGatherTexml,

  buildDialConnectTexml,

  buildAfterHoursVoicemailTexml,

  buildVoicemailRecordTexml,

  escapeXml,

};

