/**
 * @param {import('@prisma/client').V3CallSession & { legs?: import('@prisma/client').V3CallLeg[] }} row
 * @returns {import('../types').V3SessionRecord}
 */
function mapSessionRow(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    state: row.state,
    origin: row.origin,
    direction: row.direction,
    telnyxCallSessionId: row.telnyxCallSessionId,
    primaryCallControlId: row.primaryCallControlId,
    correlationId: row.correlationId,
    callerExtensionId: row.callerExtensionId,
    callerUserId: row.callerUserId,
    routeSnapshot: row.routeSnapshot && typeof row.routeSnapshot === 'object'
      ? row.routeSnapshot
      : null,
    version: row.version,
    engineVersion: row.engineVersion,
    failureCode: row.failureCode,
    answeredAt: row.answeredAt,
    endedAt: row.endedAt,
    legs: (row.legs || []).map(mapLegRow),
  };
}

/**
 * @param {import('@prisma/client').V3CallLeg} row
 * @returns {import('../types').V3LegRecord}
 */
function mapLegRow(row) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    callControlId: row.callControlId,
    role: row.role,
    state: row.state,
    connectionId: row.connectionId,
    direction: row.direction,
    fromAddress: row.fromAddress,
    toAddress: row.toAddress,
    version: row.version,
    answeredAt: row.answeredAt,
    endedAt: row.endedAt,
    hangupCause: row.hangupCause,
  };
}

module.exports = { mapSessionRow, mapLegRow };
