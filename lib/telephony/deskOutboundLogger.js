/**
 * Structured desk outbound / telephony lifecycle logs.
 */
function logDeskOutboundRoute(fields) {
  console.log(JSON.stringify({
    event: 'desk.outbound.route',
    ts: new Date().toISOString(),
    ...fields,
  }));
}

/** Canonical telephony lifecycle events (observability). */
function logDeskTelephonyEvent(event, fields = {}) {
  console.log(JSON.stringify({
    event,
    ts: new Date().toISOString(),
    ...fields,
  }));
}

module.exports = {
  logDeskOutboundRoute,
  logDeskTelephonyEvent,
};
