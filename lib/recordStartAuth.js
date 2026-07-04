const {
  getSession,
  findSession,
  resolveActiveAgentCall,
} = require('./callControlSessionStore');

function normalizeId(value) {
  return String(value || '').trim();
}

function idsMatch(a, b) {
  const left = normalizeId(a);
  const right = normalizeId(b);
  return Boolean(left && right && left === right);
}

async function assertCallControlOwnership({
  tenantId,
  sipUsername,
  callControlId,
}) {
  const id = normalizeId(callControlId);
  if (!id || !tenantId) return false;

  const direct = await getSession(id);
  if (direct?.tenantId && idsMatch(direct.tenantId, tenantId)) {
    return true;
  }

  const resolved = await findSession({ call_control_id: id });
  if (resolved?.session?.tenantId && idsMatch(resolved.session.tenantId, tenantId)) {
    return true;
  }

  const user = normalizeId(sipUsername).toLowerCase();
  if (!user) return false;

  const active = await resolveActiveAgentCall(user);
  if (!active) return false;
  if (active.tenantId && !idsMatch(active.tenantId, tenantId)) {
    return false;
  }

  const allowedIds = [
    active.inboundCallControlId,
    active.agentLegId,
    active.callerLegId,
  ].map(normalizeId).filter(Boolean);

  return allowedIds.includes(id);
}

module.exports = {
  assertCallControlOwnership,
};
