const { getPrisma } = require('../internal/prisma');
const { v3Logger } = require('../Utils/v3Logger');
const { metrics } = require('../Utils/metrics');

/**
 * Merge a nested key into routeSnapshot with optimistic locking.
 *
 * @param {{
 *   sessionId: string,
 *   version: number,
 *   nestedKey: string,
 *   patch: Record<string, unknown>,
 *   topLevelPatch?: Record<string, unknown>,
 * }} input
 * @returns {Promise<{ ok: boolean, conflict?: boolean, snapshot?: Record<string, unknown> }>}
 */
async function mergeRouteSnapshotNested(input) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: input.sessionId },
    select: { routeSnapshot: true },
  });

  const existing = row?.routeSnapshot && typeof row.routeSnapshot === 'object'
    ? row.routeSnapshot
    : {};

  const snapshot = {
    ...existing,
    ...(input.topLevelPatch || {}),
    [input.nestedKey]: {
      ...(existing[input.nestedKey] && typeof existing[input.nestedKey] === 'object'
        ? existing[input.nestedKey]
        : {}),
      ...input.patch,
    },
  };

  const result = await prisma.v3CallSession.updateMany({
    where: { id: input.sessionId, version: input.version },
    data: {
      routeSnapshot: snapshot,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    v3Logger.warn('route_snapshot.version_conflict', {
      sessionId: input.sessionId,
      nestedKey: input.nestedKey,
    });
    return { ok: false, conflict: true };
  }

  return { ok: true, snapshot };
}

/**
 * Merge top-level routeSnapshot keys (routers) without wiping nested sidecar state.
 *
 * @param {{
 *   sessionId: string,
 *   version: number,
 *   patch: Record<string, unknown>,
 * }} input
 */
async function mergeRouteSnapshotTopLevel(input) {
  const prisma = await getPrisma();
  const row = await prisma.v3CallSession.findUnique({
    where: { id: input.sessionId },
    select: { routeSnapshot: true },
  });

  const existing = row?.routeSnapshot && typeof row.routeSnapshot === 'object'
    ? row.routeSnapshot
    : {};

  const snapshot = { ...existing, ...input.patch };

  const result = await prisma.v3CallSession.updateMany({
    where: { id: input.sessionId, version: input.version },
    data: {
      routeSnapshot: snapshot,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return { ok: false, conflict: true };
  }

  return { ok: true, snapshot };
}

module.exports = {
  mergeRouteSnapshotNested,
  mergeRouteSnapshotTopLevel,
};
