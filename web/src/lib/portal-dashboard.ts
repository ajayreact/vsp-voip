import {
  getCalls,
  getDashboardStats,
  getExtensionDevices,
  getExtensionStats,
  getExtensions,
  getRingGroups,
  getTenantUsers,
} from '@/lib/api';

const ACTIVE_CALL_STATUSES = new Set([
  'ringing',
  'in-progress',
  'answered',
  'active',
  'bridged',
  'initiated',
]);

export type PortalDashboardSnapshot = {
  activeEmployees: number;
  registeredDevices: number;
  activeCalls: number;
  phoneNumbers: number;
  extensions: number;
  ringGroups: number;
  onlineExtensions: number;
  totalCalls: number;
  unreadVoicemail: number;
  recentCalls: Awaited<ReturnType<typeof getDashboardStats>>['recentCalls'];
  callStats: {
    inbound: number;
    outbound: number;
    answered: number;
    missed: number;
  };
};

export async function loadPortalDashboardSnapshot(isAdmin: boolean): Promise<PortalDashboardSnapshot> {
  const [
    dashboardStats,
    extensionStatsRes,
    devicesRes,
    extensionsRes,
    ringGroupsRes,
    callsRes,
    usersRes,
  ] = await Promise.all([
    getDashboardStats(),
    getExtensionStats(),
    getExtensionDevices(),
    getExtensions(),
    getRingGroups(),
    getCalls(100),
    isAdmin ? getTenantUsers().catch(() => ({ users: [] })) : Promise.resolve({ users: [] }),
  ]);

  const calls = callsRes.calls || [];
  const activeCalls = calls.filter(
    (call) => ACTIVE_CALL_STATUSES.has(String(call.status).toLowerCase()) && !call.endedAt,
  ).length;

  const inbound = calls.filter((c) => c.direction === 'inbound').length;
  const outbound = calls.filter((c) => c.direction === 'outbound').length;
  const answered = calls.filter((c) =>
    ['answered', 'completed', 'connected'].includes(String(c.status).toLowerCase()),
  ).length;
  const missed = calls.filter((c) =>
    ['no-answer', 'busy', 'failed', 'canceled', 'cancelled'].includes(String(c.status).toLowerCase()),
  ).length;

  return {
    activeEmployees: usersRes.users?.length ?? 0,
    registeredDevices: devicesRes.registeredDevices ?? 0,
    activeCalls,
    phoneNumbers: dashboardStats.numberCount ?? 0,
    extensions: extensionStatsRes.stats?.totalExtensions ?? extensionsRes.extensions?.length ?? 0,
    ringGroups: ringGroupsRes.ringGroups?.length ?? 0,
    onlineExtensions: extensionStatsRes.stats?.onlineExtensions ?? 0,
    totalCalls: dashboardStats.callCount ?? 0,
    unreadVoicemail: dashboardStats.unreadVoicemailCount ?? 0,
    recentCalls: dashboardStats.recentCalls ?? [],
    callStats: { inbound, outbound, answered, missed },
  };
}
