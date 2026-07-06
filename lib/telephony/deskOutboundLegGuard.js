/**
 * Desk -> PSTN outbound re-dial guard (production bug fix).
 *
 * Root cause: PstnCallService.handlePstnOutbound() dials the PSTN destination via
 * dialDestination(), which creates a brand-new Telnyx call leg using the same Call
 * Control Application connection_id that genuine desk-originated calls arrive on
 * (see PayloadNormalizer.describeCredentialConnectionOutboundGate — it accepts
 * connection_id === credential connection OR === Call Control Application).
 *
 * Telnyx fires its own call.initiated webhook for that new leg, and
 * handleParkedWebRtcOutboundInitiated() had no way to distinguish "a leg we just
 * created by dialing out" from "a genuine new desk-originated call" — both pass the
 * same connection_id gate. That caused the new leg's own call.initiated to
 * re-enter outbound routing and dial the same PSTN number again, and so on,
 * producing a self-reinforcing chain of outbound legs to the same destination.
 *
 * Telnyx's call.initiated webhook payload does not echo back the `link_to` we send
 * on the Dial request (it is a create-request-only field), so it cannot be read
 * off the webhook. Instead, this module records the call_control_id of every leg
 * WE create via handlePstnOutbound the moment the Dial API call returns it —
 * synchronously, before that leg's own call.initiated webhook can possibly arrive —
 * so handleParkedWebRtcOutboundInitiated() can recognize and skip it.
 */
const { getRedisClient } = require('../redis');

const TTL_SEC = 120;
const memoryMarks = new Map();

function buildKey(callControlId) {
  return `desk:outbound:child-leg:${callControlId}`;
}

function pruneMemoryMarks() {
  const cutoffMs = Date.now() - TTL_SEC * 1000;
  for (const [key, markedAt] of memoryMarks) {
    if (markedAt < cutoffMs) memoryMarks.delete(key);
  }
}

/** Call immediately after dialDestination()/dialAndBridge() returns the new leg's call_control_id. */
async function markDeskOutboundChildLeg(callControlId) {
  if (!callControlId) return;
  const key = buildKey(callControlId);

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    await redis.set(key, '1', 'EX', TTL_SEC);
    return;
  }

  pruneMemoryMarks();
  memoryMarks.set(key, Date.now());
}

/** Call at the top of handleParkedWebRtcOutboundInitiated() before any routing decision. */
async function isDeskOutboundChildLeg(callControlId) {
  if (!callControlId) return false;
  const key = buildKey(callControlId);

  const redis = await getRedisClient().catch(() => null);
  if (redis) {
    const value = await redis.get(key);
    return value != null;
  }

  pruneMemoryMarks();
  return memoryMarks.has(key);
}

/** Test helper — clears in-process fallback store only. */
function resetDeskOutboundLegGuardMemoryForTests() {
  memoryMarks.clear();
}

module.exports = {
  markDeskOutboundChildLeg,
  isDeskOutboundChildLeg,
  resetDeskOutboundLegGuardMemoryForTests,
};
