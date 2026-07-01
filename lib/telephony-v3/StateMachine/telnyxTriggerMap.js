/**
 * Map normalized Telnyx webhook events to internal FSM trigger events.
 * Phase 2 foundation — no Desk/Mobile/PSTN routing.
 * @param {import('../types').V3NormalizedWebhook} normalized
 * @returns {{ sessionTrigger: string|null, legTrigger: string|null, metadata?: Record<string, unknown> }}
 */
function mapTelnyxToTriggers(normalized) {
  const { eventType, state, direction } = normalized;
  const meta = { telnyxEventType: eventType, direction, telnyxState: state };

  switch (eventType) {
    case 'call.initiated':
      if (state === 'parked') {
        return { sessionTrigger: 'origin.parked', legTrigger: 'leg.created', metadata: meta };
      }
      if (direction === 'incoming') {
        return { sessionTrigger: 'session.created', legTrigger: 'leg.created', metadata: meta };
      }
      return { sessionTrigger: 'call.initiated', legTrigger: 'leg.created', metadata: meta };

    case 'call.ringing':
      return { sessionTrigger: null, legTrigger: 'call.ringing', metadata: meta };

    case 'call.answered':
      return { sessionTrigger: 'call.answered', legTrigger: 'call.answered', metadata: meta };

    case 'call.bridged':
      return { sessionTrigger: 'bridge.completed', legTrigger: 'bridge.completed', metadata: meta };

    case 'call.hangup':
    case 'call.dial.hangup':
      return { sessionTrigger: 'leg.ended', legTrigger: 'leg.hangup', metadata: meta };

    case 'call.dial.failed':
    case 'call.dial.busy':
    case 'call.dial.no_answer':
      return { sessionTrigger: 'call.failed', legTrigger: 'call.failed', metadata: meta };

    default:
      return { sessionTrigger: null, legTrigger: null, metadata: meta };
  }
}

/** Media events handled by sidecar coordinator (no FSM transition). */
const MEDIA_EVENT_TYPES = new Set([
  'call.gather.ended',
  'call.recording.saved',
  'call.speak.ended',
  'call.playback.ended',
]);

function isMediaSidecarEvent(eventType) {
  return MEDIA_EVENT_TYPES.has(eventType);
}

module.exports = { mapTelnyxToTriggers, isMediaSidecarEvent, MEDIA_EVENT_TYPES };
