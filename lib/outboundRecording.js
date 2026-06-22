const axios = require('axios');
const {
  buildRecordingClientState,
  saveCallRecordingFromCallControlEvent,
} = require('./callRecording');
const { saveVoicemailFromCallControlEvent, parseVoicemailClientState } = require('./voicemail');
const { hangupCall } = require('./telnyxCallControl');

const TELNYX_API_KEY = process.env.TELNYX_API_KEY?.trim();

async function startOutboundCallRecording({
  callControlId,
  tenantId,
  from,
  to,
}) {
  if (!TELNYX_API_KEY) {
    throw Object.assign(new Error('TELNYX_API_KEY is not configured'), { status: 500 });
  }
  if (!callControlId) {
    throw Object.assign(new Error('callControlId is required'), { status: 400 });
  }

  const clientState = buildRecordingClientState({
    tenantId,
    from,
    to,
    direction: 'outbound',
  });

  try {
    const response = await axios.post(
      `https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/record_start`,
      {
        format: 'mp3',
        channels: 'dual',
        client_state: clientState,
      },
      {
        headers: {
          Authorization: `Bearer ${TELNYX_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    );
    return {
      started: true,
      callControlId,
      data: response.data?.data ?? null,
    };
  } catch (error) {
    const detail = error.response?.data?.errors?.[0]?.detail || error.message;
    throw Object.assign(new Error(detail || 'Telnyx rejected record_start'), {
      status: error.response?.status || 502,
    });
  }
}

async function handleCallControlRecordingWebhook(prisma, body) {
  const eventType = body?.data?.event_type;
  if (eventType !== 'call.recording.saved') return null;

  const payload = body?.data?.payload;
  if (parseVoicemailClientState(payload?.client_state)) {
    const saved = await saveVoicemailFromCallControlEvent(prisma, body);
    if (saved && payload?.call_control_id) {
      try {
        await hangupCall(payload.call_control_id);
      } catch {
        /* call may already be ended */
      }
    }
    return saved;
  }

  return saveCallRecordingFromCallControlEvent(prisma, body);
}

module.exports = {
  startOutboundCallRecording,
  handleCallControlRecordingWebhook,
};
