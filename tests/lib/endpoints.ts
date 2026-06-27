/**
 * REST endpoint registry for integration coverage tests.
 * QA-only — not imported by production code.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type AuthLevel = 'public' | 'jwt' | 'admin';

export type EndpointSpec = {
  /** Human-readable group for reports */
  group: string;
  method: HttpMethod;
  path: string;
  auth: AuthLevel;
  /** Status codes acceptable without Authorization header */
  anonAccept: number[];
  /** Status codes acceptable with tenant JWT (when auth !== public) */
  authedAccept?: number[];
  body?: unknown;
  /** Skip destructive or side-effecting routes in default probe */
  skipProbe?: boolean;
};

const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000001';
const PLACEHOLDER_DEVICE = 'device-placeholder';
const PLACEHOLDER_PHONE = '+15551234567';

export const REST_ENDPOINTS: EndpointSpec[] = [
  // Health (server.js)
  { group: 'health', method: 'GET', path: '/health', auth: 'public', anonAccept: [200] },
  { group: 'health', method: 'GET', path: '/ready', auth: 'public', anonAccept: [200, 503] },

  // Auth
  { group: 'auth', method: 'POST', path: '/api/auth/login', auth: 'public', anonAccept: [400, 401, 422], body: { email: '', password: '' } },
  { group: 'auth', method: 'POST', path: '/api/auth/refresh', auth: 'public', anonAccept: [400, 401], body: {} },
  { group: 'auth', method: 'POST', path: '/api/auth/logout', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'auth', method: 'POST', path: '/api/auth/forgot-password', auth: 'public', anonAccept: [200, 400], body: { email: 'qa@example.com' } },
  { group: 'auth', method: 'POST', path: '/api/auth/reset-password', auth: 'public', anonAccept: [400, 401], body: { token: 'invalid', password: 'x' } },
  { group: 'auth', method: 'GET', path: '/api/auth/me', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'auth', method: 'POST', path: '/api/mobile/provision', auth: 'public', anonAccept: [400, 401, 403], body: {} },

  // Tenant & dashboard
  { group: 'tenant', method: 'GET', path: '/api/tenant/profile', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'tenant', method: 'PUT', path: '/api/tenant/profile', auth: 'jwt', anonAccept: [401], authedAccept: [400, 403, 200], body: {}, skipProbe: true },
  { group: 'tenant', method: 'GET', path: '/api/tenant/users', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'tenant', method: 'GET', path: '/api/tenant/subscription', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'tenant', method: 'GET', path: '/api/dashboard/stats', auth: 'jwt', anonAccept: [401], authedAccept: [200] },

  // Softphone (route existence + auth only)
  { group: 'softphone', method: 'GET', path: '/api/softphone/config', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'softphone', method: 'GET', path: '/api/softphone/diagnostics', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'softphone', method: 'POST', path: '/api/softphone/token', auth: 'jwt', anonAccept: [401], authedAccept: [200, 400, 403], body: {}, skipProbe: true },
  { group: 'softphone', method: 'GET', path: '/api/softphone/devices', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'softphone', method: 'DELETE', path: `/api/softphone/devices/${PLACEHOLDER_DEVICE}`, auth: 'jwt', anonAccept: [401], authedAccept: [404, 400, 200], skipProbe: true },
  { group: 'softphone', method: 'POST', path: '/api/softphone/call-accepted', auth: 'jwt', anonAccept: [401], authedAccept: [400, 404, 200], body: { callControlId: 'test' }, skipProbe: true },
  { group: 'softphone', method: 'POST', path: '/api/softphone/transfer/blind', auth: 'jwt', anonAccept: [401], authedAccept: [400, 404], body: {}, skipProbe: true },
  { group: 'softphone', method: 'POST', path: '/api/softphone/presence', auth: 'jwt', anonAccept: [401], authedAccept: [200, 400], body: { status: 'available' }, skipProbe: true },
  { group: 'softphone', method: 'POST', path: '/api/softphone/telemetry', auth: 'jwt', anonAccept: [401], authedAccept: [200, 400], body: { event: 'qa-probe' }, skipProbe: true },

  // Calls, numbers, voicemail, recordings
  { group: 'calls', method: 'GET', path: '/api/calls', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'numbers', method: 'GET', path: '/api/numbers/mine', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'numbers', method: 'GET', path: '/api/numbers/connections', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'voicemail', method: 'GET', path: '/api/tenant/voicemails', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'recordings', method: 'GET', path: '/api/tenant/recordings', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'recordings', method: 'GET', path: '/api/tenant/recordings/setup', auth: 'jwt', anonAccept: [401], authedAccept: [200] },

  // Legacy SMS
  { group: 'sms-legacy', method: 'GET', path: '/api/sms/config', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'sms-legacy', method: 'GET', path: '/api/sms/conversations', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'sms-legacy', method: 'GET', path: '/api/sms/messages', auth: 'jwt', anonAccept: [401], authedAccept: [200, 400] },
  { group: 'sms-legacy', method: 'POST', path: '/api/sms/send', auth: 'jwt', anonAccept: [401], authedAccept: [400, 403], body: { from: '', to: '', text: '' }, skipProbe: true },

  // Messaging API
  { group: 'messaging', method: 'GET', path: '/api/conversations', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'messaging', method: 'GET', path: '/api/conversations/by-peer', auth: 'jwt', anonAccept: [401], authedAccept: [200, 400] },
  { group: 'messaging', method: 'GET', path: `/api/conversations/${PLACEHOLDER_UUID}/messages`, auth: 'jwt', anonAccept: [401], authedAccept: [200, 403, 404] },
  { group: 'messaging', method: 'PATCH', path: `/api/conversations/${PLACEHOLDER_UUID}/read`, auth: 'jwt', anonAccept: [401], authedAccept: [200, 403, 404], skipProbe: true },
  { group: 'messaging', method: 'POST', path: '/api/messages/send', auth: 'jwt', anonAccept: [401], authedAccept: [400, 403], body: { from: '', to: '', text: '' }, skipProbe: true },
  { group: 'messaging', method: 'POST', path: '/api/messages/attachments', auth: 'jwt', anonAccept: [401], authedAccept: [400], body: {} },
  { group: 'messaging', method: 'GET', path: `/api/messages/attachments/${PLACEHOLDER_UUID}/url`, auth: 'jwt', anonAccept: [401], authedAccept: [403, 404] },
  { group: 'messaging', method: 'GET', path: `/api/messages/${PLACEHOLDER_UUID}/status`, auth: 'jwt', anonAccept: [401], authedAccept: [403, 404] },

  // Billing (read-only probes)
  { group: 'billing', method: 'GET', path: '/api/billing/config', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'billing', method: 'GET', path: '/api/billing/orders', auth: 'jwt', anonAccept: [401], authedAccept: [200] },
  { group: 'billing', method: 'POST', path: '/api/billing/quote', auth: 'jwt', anonAccept: [401], authedAccept: [200, 400], body: { items: [] }, skipProbe: true },

  // Greeting / routing
  { group: 'routing', method: 'GET', path: `/api/tenants/${PLACEHOLDER_UUID}/greeting`, auth: 'jwt', anonAccept: [401], authedAccept: [403, 404] },
  { group: 'routing', method: 'GET', path: `/api/tenants/${PLACEHOLDER_UUID}/call-routing`, auth: 'jwt', anonAccept: [401], authedAccept: [403, 404] },

  // Extensions
  { group: 'extensions', method: 'GET', path: '/api/tenant/extensions', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'extensions', method: 'GET', path: '/api/tenant/extensions/stats', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'extensions', method: 'GET', path: '/api/tenant/extensions/devices', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'extensions', method: 'GET', path: '/api/tenant/extensions/registration', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'extensions', method: 'GET', path: '/api/tenant/extensions/destinations', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'extensions', method: 'GET', path: `/api/tenant/extensions/${PLACEHOLDER_UUID}`, auth: 'jwt', anonAccept: [401], authedAccept: [403, 404] },
  { group: 'extensions', method: 'GET', path: '/api/tenant/ownership/validate', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'extensions', method: 'GET', path: `/api/tenant/ownership/chain/${encodeURIComponent(PLACEHOLDER_PHONE)}`, auth: 'jwt', anonAccept: [401], authedAccept: [200, 403, 404] },

  // Ring groups
  { group: 'ring-groups', method: 'GET', path: '/api/tenant/ring-groups', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'ring-groups', method: 'GET', path: '/api/tenant/ring-groups/destinations', auth: 'jwt', anonAccept: [401], authedAccept: [200, 403] },
  { group: 'ring-groups', method: 'GET', path: `/api/tenant/ring-groups/${PLACEHOLDER_UUID}`, auth: 'jwt', anonAccept: [401], authedAccept: [403, 404] },

  // Admin (SUPER_ADMIN)
  { group: 'admin', method: 'GET', path: '/api/admin/dashboard', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/tenants', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/numbers/inventory', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/monitoring/platform-health', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/telephony-health', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/telnyx/status', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/orders', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/revenue', auth: 'admin', anonAccept: [401], authedAccept: [403] },
  { group: 'admin', method: 'GET', path: '/api/admin/audit-log', auth: 'admin', anonAccept: [401], authedAccept: [403] },
];

export function endpointsForProbe(includeSkipped = false): EndpointSpec[] {
  return REST_ENDPOINTS.filter((ep) => includeSkipped || !ep.skipProbe);
}

export function endpointKey(ep: EndpointSpec): string {
  return `${ep.method} ${ep.path}`;
}
