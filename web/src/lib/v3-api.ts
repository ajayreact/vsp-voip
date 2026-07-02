import { apiFetch } from './api';

/** Frontend V3 feature flag. Inlined at build time by Next from NEXT_PUBLIC_V3_PORTAL. */
export function isV3PortalEnabled(): boolean {
  const value = (process.env.NEXT_PUBLIC_V3_PORTAL || '').toLowerCase();
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export type HealthLevel = 'green' | 'yellow' | 'red';

export type EmployeeHealthChecks = {
  employee: HealthLevel;
  extension: HealthLevel;
  credential: HealthLevel;
  sipUsername: HealthLevel;
  device: HealthLevel;
  registration: HealthLevel;
  did: HealthLevel;
  webhookReady: HealthLevel;
  callControlReady: HealthLevel;
  softphoneReady: HealthLevel;
};

export type EmployeeHealth = {
  employeeId: string;
  name: string;
  email: string;
  extensionId: string | null;
  extensionNumber: string | null;
  sipUsername: string | null;
  did: string | null;
  overall: HealthLevel;
  checks: EmployeeHealthChecks;
};

export type HealthSummary = {
  totalEmployees: number;
  ready: number;
  warnings: number;
  errors: number;
  registeredSip: number;
  unregisteredSip: number;
};

export type TelephonyReadiness = {
  credentialConnectionId: string | null;
  callControlApplicationId: string | null;
  credentialReady: boolean;
  callControlReady: boolean;
  webhookReady: boolean;
};

export async function getV3Health() {
  return apiFetch<{
    success: boolean;
    summary: HealthSummary;
    employees: EmployeeHealth[];
    readiness: TelephonyReadiness;
    pbx?: PbxHealthResponse;
    softphone?: SoftphoneHealthResponse;
    systemHealth?: SystemHealthResponse;
  }>('/api/v3/health');
}

export type CreateV3EmployeeResult = {
  success: boolean;
  employee: { id: string; email: string; name: string; role: string };
  extension: { id: string; extensionNumber: string; displayName?: string };
  provision: { ok: boolean; provisioned: boolean; telnyxSipUsername: string | null; reason?: string };
  health: EmployeeHealth | null;
};

export async function createV3Employee(data: { name: string; email: string; password: string }) {
  return apiFetch<CreateV3EmployeeResult>('/api/v3/employees', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type RepairChange = {
  type: string;
  entity: string;
  ref: string;
  detail: string;
};

export type RepairAppliedChange = RepairChange & { ok: boolean; error?: string };

export type RepairInspectReport = {
  success: boolean;
  mode: string;
  scanned: { extensions: number; users: number; phoneNumbers: number };
  changes: RepairChange[];
  observations: string[];
};

export type RepairApplyReport = RepairInspectReport & { applied: RepairAppliedChange[] };

export async function inspectV3Repair() {
  return apiFetch<RepairInspectReport>('/api/v3/repair/inspect', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function applyV3Repair() {
  return apiFetch<RepairApplyReport>('/api/v3/repair/apply', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function provisionV3Device(employeeId: string, target: 'sip_phone' | 'mobile' = 'sip_phone') {
  return apiFetch<{
    success: boolean;
    extensionId: string;
    extensionNumber: string;
    provision: { ok: boolean; provisioned: boolean };
  }>(`/api/v3/employees/${employeeId}/provision-device`, {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
}

// --- Phase 2: Number Inventory & Marketplace ---

export type InventoryStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'ASSIGNED'
  | 'PORTING'
  | 'RELEASE_PENDING'
  | 'SUSPENDED';

export type InventoryNumber = {
  id: string;
  number: string;
  inventoryStatus: InventoryStatus;
  country: string | null;
  region: string | null;
  locality: string | null;
  capabilities: string[];
  monthlyCost: number | null;
  tenantId: string | null;
  tenantName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  extensionId: string | null;
  extensionNumber: string | null;
  routingType: string;
  notes: string | null;
};

export type NumberHealthChecks = {
  inventoryStatus: HealthLevel;
  assigned: HealthLevel;
  routingOk: HealthLevel;
  employeeLinked: HealthLevel;
  extensionLinked: HealthLevel;
  credentialReady: HealthLevel;
  registration: HealthLevel;
  callControlReady: HealthLevel;
  webhookReady: HealthLevel;
};

export type NumberHealth = {
  phoneNumberId: string;
  number: string;
  inventoryStatus: InventoryStatus;
  overall: HealthLevel;
  checks: NumberHealthChecks;
};

export async function getV3Numbers(params?: { search?: string; status?: string; tenantScoped?: boolean }) {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.status) q.set('status', params.status);
  if (params?.tenantScoped) q.set('tenantScoped', 'true');
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<{ success: boolean; scope: string; items: InventoryNumber[]; total: number; summary: Record<string, number> }>(
    `/api/v3/numbers${suffix}`,
  );
}

export async function searchV3Marketplace(filters: Record<string, unknown>) {
  return apiFetch<{ success: boolean; availableNumbers: Array<{ phoneNumber: string; locality: string; state: string; monthlyCost: string | null }>; count: number }>(
    '/api/v3/numbers/search',
    { method: 'POST', body: JSON.stringify(filters) },
  );
}

export async function purchaseV3Number(data: { phoneNumber: string; monthlyCost?: string; reserveOnly?: boolean; notes?: string }) {
  return apiFetch<{ success: boolean; number?: InventoryNumber; reserved?: InventoryNumber }>(
    '/api/v3/numbers/purchase',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export async function assignV3Number(data: {
  phoneNumberId: string;
  tenantId?: string;
  extensionId?: string;
  employeeId?: string;
  notes?: string;
}) {
  return apiFetch<{ success: boolean; assignment: string }>(
    '/api/v3/numbers/assign',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export async function unassignV3Number(data: { phoneNumberId: string; fromTenant?: boolean }) {
  return apiFetch<{ success: boolean; unassign: string }>(
    '/api/v3/numbers/unassign',
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export async function releaseV3Number(phoneNumberId: string, notes?: string) {
  return apiFetch<{ success: boolean }>(
    '/api/v3/numbers/release',
    { method: 'POST', body: JSON.stringify({ phoneNumberId, notes }) },
  );
}

export async function repairV3Numbers(apply = false, global = false) {
  return apiFetch<{ success: boolean; mode: string; changes: RepairChange[]; applied: RepairAppliedChange[]; observations: string[] }>(
    '/api/v3/numbers/repair',
    { method: 'POST', body: JSON.stringify({ apply, global }) },
  );
}

export async function getV3NumbersHealth(global = false) {
  const suffix = global ? '?global=true' : '';
  return apiFetch<{ success: boolean; numbers: NumberHealth[]; summary: { total: number; ready: number; warnings: number; errors: number } }>(
    `/api/v3/numbers/health${suffix}`,
  );
}

// --- Phase 3: Desk Phone Management ---

export type DeskDeviceStatus = 'CREATED' | 'ASSIGNED' | 'PROVISIONED' | 'REGISTERED' | 'REMOVED';
export type DeskRegistrationStatus = 'registered' | 'offline' | 'never';

export type DeskDevice = {
  id: string;
  tenantId: string;
  vendor: string;
  model: string | null;
  macAddress: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  employeeId: string | null;
  employeeName: string | null;
  extensionId: string | null;
  extensionNumber: string | null;
  did: string | null;
  sipUsername: string | null;
  status: DeskDeviceStatus;
  registrationStatus: DeskRegistrationStatus;
  lastRegistrationAt: string | null;
  lastSeenAt: string | null;
  lastProvisionedAt: string | null;
  provisionUrl: string | null;
  configVersion: number;
  provisionVersion: number;
  notes: string | null;
};

export type DeviceHealthChecks = {
  inventoryStatus: HealthLevel;
  extensionLinked: HealthLevel;
  employeeLinked: HealthLevel;
  credentialReady: HealthLevel;
  provisionReady: HealthLevel;
  vendorTemplate: HealthLevel;
  provisionUrl: HealthLevel;
  registration: HealthLevel;
  callControlReady: HealthLevel;
  webhookReady: HealthLevel;
};

export type DeviceHealth = {
  deviceId: string;
  macAddress: string | null;
  vendor: string;
  model: string | null;
  extensionNumber: string | null;
  employeeName: string | null;
  status: DeskDeviceStatus;
  registrationStatus: DeskRegistrationStatus;
  overall: HealthLevel;
  checks: DeviceHealthChecks;
  reasons: string[];
  firmwareVersion: string | null;
  lastRegistrationAt: string | null;
  lastSeenAt: string | null;
  lastProvisionedAt: string | null;
  provisionVersion: number;
  configVersion: number;
};

export async function getV3Devices(params?: { search?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.status) q.set('status', params.status);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<{ success: boolean; items: DeskDevice[]; total: number }>(`/api/v3/devices${suffix}`);
}

export async function createV3Device(data: {
  vendor: string;
  model?: string;
  macAddress?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  notes?: string;
}) {
  return apiFetch<{ success: boolean; device: DeskDevice }>('/api/v3/devices', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateV3Device(id: string, data: Partial<DeskDevice>) {
  return apiFetch<{ success: boolean; device: DeskDevice }>(`/api/v3/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function removeV3Device(id: string) {
  return apiFetch<{ success: boolean; device: DeskDevice }>(`/api/v3/devices/${id}`, {
    method: 'DELETE',
  });
}

export async function provisionV3DeskDevice(deviceId: string, regenerate = false) {
  return apiFetch<{
    success: boolean;
    device: DeskDevice;
    config: { format: string; contentType: string; body: string; vendor: string };
    provisionUrl: string;
  }>('/api/v3/devices/provision', {
    method: 'POST',
    body: JSON.stringify({ deviceId, regenerate }),
  });
}

export async function repairV3Devices(apply = false, regenerate = false) {
  return apiFetch<{ success: boolean; mode: string; changes: RepairChange[]; applied: RepairAppliedChange[]; observations: string[] }>(
    '/api/v3/devices/repair',
    { method: 'POST', body: JSON.stringify({ apply, regenerate }) },
  );
}

export async function getV3DevicesHealth() {
  return apiFetch<{
    success: boolean;
    devices: DeviceHealth[];
    summary: {
      total: number;
      registered: number;
      offline: number;
      neverRegistered: number;
      ready: number;
      warnings: number;
      errors: number;
    };
  }>('/api/v3/devices/health');
}

export async function getV3DeviceVendors() {
  return apiFetch<{ success: boolean; vendors: Array<{ id: string; label: string }> }>('/api/v3/devices/vendors');
}

// --- Phase 4: Call Flow Builder (engine only) ---

export type CallFlowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type FlowNode = {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  label: string | null;
};

export type CallFlowDefinition = {
  version: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export type CallFlow = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  did: string | null;
  status: CallFlowStatus;
  version: number;
  definition: CallFlowDefinition;
  nodeCount: number;
  edgeCount: number;
};

export type CallFlowValidationIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  nodeId?: string | null;
};

export type CallFlowSimulationStep = {
  nodeId: string;
  nodeType: string;
  label: string;
  action: string;
  terminal: boolean;
  destination: Record<string, unknown> | null;
  detail: Record<string, unknown>;
};

export async function getV3CallFlows(params?: { search?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.status) q.set('status', params.status);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return apiFetch<{ success: boolean; items: CallFlow[]; total: number }>(`/api/v3/callflows${suffix}`);
}

export async function getV3CallFlow(id: string) {
  return apiFetch<{ success: boolean; callFlow: CallFlow }>(`/api/v3/callflows/${id}`);
}

export async function createV3CallFlow(data: { name: string; description?: string; did?: string; definition?: CallFlowDefinition }) {
  return apiFetch<{ success: boolean; callFlow: CallFlow }>('/api/v3/callflows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateV3CallFlow(id: string, data: Partial<CallFlow>) {
  return apiFetch<{ success: boolean; callFlow: CallFlow }>(`/api/v3/callflows/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteV3CallFlow(id: string) {
  return apiFetch<{ success: boolean; callFlow: CallFlow }>(`/api/v3/callflows/${id}`, {
    method: 'DELETE',
  });
}

export async function validateV3CallFlow(payload: { callFlowId?: string; definition?: CallFlowDefinition }) {
  return apiFetch<{
    success: boolean;
    valid: boolean;
    issues: CallFlowValidationIssue[];
    errors: CallFlowValidationIssue[];
    warnings: CallFlowValidationIssue[];
  }>('/api/v3/callflows/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function simulateV3CallFlow(payload: {
  callFlowId?: string;
  definition?: CallFlowDefinition;
  input?: {
    incomingDid?: string;
    did?: string;
    currentTime?: string;
    businessHours?: Record<string, unknown>;
    pressedDigits?: string[];
    holidays?: string[];
  };
}) {
  return apiFetch<{
    success: boolean;
    ok: boolean;
    executionPath: CallFlowSimulationStep[];
    finalDestination: Record<string, unknown> | null;
    warnings: CallFlowValidationIssue[];
    errors: CallFlowValidationIssue[];
  }>('/api/v3/callflows/simulate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getV3CallFlowNodeTypes() {
  return apiFetch<{ success: boolean; nodeTypes: Array<{ type: string; label: string; color: string; terminal: boolean }> }>(
    '/api/v3/callflows/node-types',
  );
}

// --- Phase 5: PBX Objects ---

export type PbxValidationIssue = { severity: string; code: string; message: string };

async function pbxList(path: string, search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch<{ success: boolean; items: Record<string, unknown>[]; total: number }>(`/api/v3/${path}${q}`);
}

async function pbxCreate(path: string, data: Record<string, unknown>) {
  return apiFetch<{ success: boolean; item: Record<string, unknown> }>(`/api/v3/${path}`, { method: 'POST', body: JSON.stringify(data) });
}

async function pbxUpdate(path: string, id: string, data: Record<string, unknown>) {
  return apiFetch<{ success: boolean; item: Record<string, unknown> }>(`/api/v3/${path}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

async function pbxDelete(path: string, id: string) {
  return apiFetch<{ success: boolean }>(`/api/v3/${path}/${id}`, { method: 'DELETE' });
}

async function pbxValidate(path: string, data: Record<string, unknown>) {
  return apiFetch<{ success: boolean; valid: boolean; errors: PbxValidationIssue[]; warnings: PbxValidationIssue[] }>(
    `/api/v3/${path}/validate`,
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export const v3RingGroupsApi = {
  list: (search?: string) => pbxList('ringgroups', search),
  create: (data: Record<string, unknown>) => pbxCreate('ringgroups', data),
  update: (id: string, data: Record<string, unknown>) => pbxUpdate('ringgroups', id, data),
  delete: (id: string) => pbxDelete('ringgroups', id),
  validate: (data: Record<string, unknown>) => pbxValidate('ringgroups', data),
};

export const v3QueuesApi = {
  list: (search?: string) => pbxList('queues', search),
  create: (data: Record<string, unknown>) => pbxCreate('queues', data),
  update: (id: string, data: Record<string, unknown>) => pbxUpdate('queues', id, data),
  delete: (id: string) => pbxDelete('queues', id),
  validate: (data: Record<string, unknown>) => pbxValidate('queues', data),
};

export const v3BusinessHoursApi = {
  list: (search?: string) => pbxList('business-hours', search),
  create: (data: Record<string, unknown>) => pbxCreate('business-hours', data),
  update: (id: string, data: Record<string, unknown>) => pbxUpdate('business-hours', id, data),
  delete: (id: string) => pbxDelete('business-hours', id),
  validate: (data: Record<string, unknown>) => pbxValidate('business-hours', data),
};

export const v3HolidaysApi = {
  list: (search?: string) => pbxList('holidays', search),
  create: (data: Record<string, unknown>) => pbxCreate('holidays', data),
  update: (id: string, data: Record<string, unknown>) => pbxUpdate('holidays', id, data),
  delete: (id: string) => pbxDelete('holidays', id),
  validate: (data: Record<string, unknown>) => pbxValidate('holidays', data),
};

export const v3VoicemailsApi = {
  list: (search?: string) => pbxList('voicemails', search),
  create: (data: Record<string, unknown>) => pbxCreate('voicemails', data),
  update: (id: string, data: Record<string, unknown>) => pbxUpdate('voicemails', id, data),
  delete: (id: string) => pbxDelete('voicemails', id),
  validate: (data: Record<string, unknown>) => pbxValidate('voicemails', data),
};

export type PbxObjectHealth = {
  id: string;
  type: string;
  name: string;
  overall: HealthLevel;
  checks: Record<string, HealthLevel>;
  reasons: string[];
};

export type PbxHealthResponse = {
  ringGroups: PbxObjectHealth[];
  queues: PbxObjectHealth[];
  businessHours: PbxObjectHealth[];
  holidays: PbxObjectHealth[];
  voicemails: PbxObjectHealth[];
  summary: { total: number; ready: number; warnings: number; errors: number };
};

// --- Phase 6: Softphone UX ---

export type SoftphoneProfile = {
  id: string;
  tenantId: string;
  userId: string;
  preferredCallerId: string | null;
  preferredDevice: string | null;
  defaultAudioDevice: string | null;
  ringDevice: string | null;
  theme: string;
  language: string;
  timezone: string | null;
  callRecordingPreference: string;
  autoAnswer: boolean;
  dnd: boolean;
  busy: boolean;
  away: boolean;
  presenceVisibility: string;
  favoriteContactIds: string[];
  speedDial: Array<{ slot: number; contactId: string | null; label: string | null; number: string | null }>;
  recentContacts: string[];
};

export type PresenceConfig = {
  id: string;
  status: string;
  message: string | null;
};

export type DirectoryContact = {
  contactId: string;
  userId: string;
  name: string;
  email: string;
  extensionNumber: string | null;
  department: string | null;
  did: string | null;
  deviceLabel: string | null;
  isFavorite: boolean;
};

export type DevicePreference = {
  id: string;
  deviceType: string;
  deviceAlias: string | null;
  lastActiveAt: string | null;
  preferred: boolean;
  notificationPreference: string;
  ringPreference: string;
};

export type SoftphoneHealthUser = {
  userId: string;
  overall: HealthLevel;
  checks: Record<string, HealthLevel>;
  preferredDevice: string | null;
  callerId: string | null;
  presenceStatus: string;
};

export type SoftphoneHealthResponse = {
  users: SoftphoneHealthUser[];
  directory: { userCount: number; extensionCount: number; linkedCount: number; synced: boolean };
  summary: { total: number; ready: number; warnings: number; errors: number };
};

export async function getV3Profile(userId?: string) {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiFetch<{ success: boolean; profile: SoftphoneProfile }>(`/api/v3/profile${q}`);
}

export async function updateV3Profile(data: Partial<SoftphoneProfile> & { userId?: string }) {
  return apiFetch<{ success: boolean; profile: SoftphoneProfile }>('/api/v3/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function searchV3Directory(params?: {
  search?: string;
  department?: string;
  favorites?: boolean;
  recent?: boolean;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.department) qs.set('department', params.department);
  if (params?.favorites) qs.set('favorites', 'true');
  if (params?.recent) qs.set('recent', 'true');
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const q = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<{
    success: boolean;
    items: DirectoryContact[];
    total: number;
    favorites: number;
    recent: number;
    speedDial: SoftphoneProfile['speedDial'];
  }>(`/api/v3/directory${q}`);
}

export async function getV3Presence(userId?: string) {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiFetch<{ success: boolean; presence: PresenceConfig }>(`/api/v3/presence${q}`);
}

export async function updateV3Presence(data: { status: string; message?: string; userId?: string }) {
  return apiFetch<{ success: boolean; presence: PresenceConfig }>('/api/v3/presence', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getV3Preferences(userId?: string) {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return apiFetch<{
    success: boolean;
    preferences: { preferences: Record<string, unknown> };
    devices: { items: DevicePreference[]; total: number };
  }>(`/api/v3/preferences${q}`);
}

export async function updateV3Preferences(data: {
  preferences?: Record<string, unknown>;
  device?: Partial<DevicePreference> & { deviceType: string };
  devices?: Array<Partial<DevicePreference> & { deviceType: string }>;
  userId?: string;
}) {
  return apiFetch<{
    success: boolean;
    preferences: { preferences: Record<string, unknown> };
    devices: { items: DevicePreference[]; total: number };
  }>('/api/v3/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// --- Phase 7: Operations Center ---

export type ChartPoint = { label: string; value: number };
export type GrowthPoint = { label: string; count: number; cumulative: number };

export type DashboardCards = {
  employees: number;
  extensions: number;
  activeDevices: number;
  registeredDevices: number;
  totalNumbers: number;
  availableNumbers: number;
  assignedNumbers: number;
  deskPhones: number;
  ringGroups: number;
  queues: number;
  businessHours: number;
  holidays: number;
  voicemailBoxes: number;
  callFlows: number;
  softphoneProfiles: number;
};

export type DashboardCharts = {
  employeeGrowth: GrowthPoint[];
  extensionGrowth: GrowthPoint[];
  deviceTypes: ChartPoint[];
  vendorDistribution: ChartPoint[];
  phoneModelDistribution: ChartPoint[];
  didUsage: ChartPoint[];
  provisioningSuccess: ChartPoint[];
  healthScore: Record<string, number>;
  presenceDistribution: ChartPoint[];
  departmentDistribution: ChartPoint[];
};

export type V3Notification = {
  id: string;
  severity: string;
  category: string;
  title: string;
  message: string;
  source: string;
  actionable: boolean;
  readOnly: boolean;
};

export type ActivityEvent = {
  id: string;
  action: string;
  category: string;
  label: string;
  entityType: string | null;
  entityId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  createdAt: string;
};

export type SystemHealthResponse = {
  overallScore: number;
  overallLevel: HealthLevel;
  domains: Record<string, { level: HealthLevel; score: number }>;
  departmentHealth: Array<{
    department: string;
    employeeCount: number;
    ready: number;
    warnings: number;
    errors: number;
    overall: HealthLevel;
  }>;
  historicalTrend: Array<{ label: string; healthScore: number; employeeCount: number }>;
  repairSuggestions: Array<{ source: string; severity: string; type: string; detail: string; ref: string }>;
  lifecycleHealth?: {
    license: { level: HealthLevel; warnings: number };
    storage: { level: HealthLevel; totalEstimatedMb: number };
    backup: { level: HealthLevel; count: number };
    subscription: { level: HealthLevel; renewalDate: string | null };
    billing: { level: HealthLevel; status: string };
    overall: HealthLevel;
  };
};

export async function getV3Dashboard() {
  return apiFetch<{ success: boolean; dashboard: { cards: DashboardCards; healthIssues: { total: number }; repairRecommendations: { total: number }; charts: DashboardCharts } }>('/api/v3/dashboard');
}

export async function getV3Analytics() {
  return apiFetch<{ success: boolean; analytics: { charts: DashboardCharts } }>('/api/v3/analytics');
}

export async function getV3Reports(type?: string) {
  const q = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch<{ success: boolean; reports?: Array<{ type: string; title: string; rowCount: number }>; report?: { title: string; columns: Array<{ key: string; label: string }>; rows: Record<string, string>[] } }>(`/api/v3/reports${q}`);
}

export async function getV3Activity(params?: { limit?: number; category?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.category) qs.set('category', params.category);
  const q = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<{ success: boolean; items: ActivityEvent[]; total: number }>(`/api/v3/activity${q}`);
}

export async function getV3Notifications() {
  return apiFetch<{ success: boolean; notifications: V3Notification[]; summary: { total: number; errors: number; warnings: number } }>('/api/v3/notifications');
}

export async function getV3SystemHealth() {
  return apiFetch<{ success: boolean; systemHealth: SystemHealthResponse }>('/api/v3/system-health');
}

export async function exportV3Report(type: string, format: 'csv' | 'excel' | 'pdf') {
  const { getToken } = await import('./api');
  const token = getToken();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${API_URL}/api/v3/reports/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ type, format }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || `${type}.${format === 'excel' ? 'xls' : format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Phase 8: Billing & Lifecycle ---

export type V3BillingInvoiceRow = {
  id: string;
  invoiceNumber?: string | null;
  status?: string;
  amount?: number | null;
  createdAt?: string;
};

export type V3BillingOverview = {
  plan?: {
    name?: string;
    billingStatus?: string;
    platformFeeMonthly?: number | null;
  };
  usage?: {
    seats?: number;
    extensions?: number;
    numbers?: number;
    deskPhones?: number;
    storage?: { totalEstimatedMb?: number };
    smsUsage?: { last30Days?: number };
    recordingUsage?: { count?: number };
  };
  costs?: { estimatedMonthlyTotal?: number | null };
  renewalDate?: string | null;
  invoices?: V3BillingInvoiceRow[];
  receivables?: V3BillingInvoiceRow[];
};

export type V3PlanTier = {
  tier: string;
  label: string;
  maxUsers?: number;
  maxPhoneNumbers?: number;
  maxConcurrentCalls?: number;
};

export type V3SubscriptionOverview = {
  currentPlan?: { tier?: string; label?: string; renewalDate?: string | null };
  limits?: { seats?: number; numbers?: number };
  usage?: { seats?: number; numbers?: number };
  availableTiers?: V3PlanTier[];
  featureMatrix?: Record<string, boolean>;
};

export type V3LicenseWarning = {
  code: string;
  message: string;
  severity: 'warning' | 'error';
};

export type V3LicenseOverview = {
  health?: Record<string, HealthLevel | string>;
  utilization?: { seats?: number; numbers?: number; extensions?: number };
  warnings?: V3LicenseWarning[];
};

export type V3BackupItem = {
  id: string;
  label: string;
  itemCounts: Record<string, number>;
  sizeBytes: number;
  createdAt: string;
};

export type V3RestoreResult = {
  applied?: unknown[];
};

export type V3LifecycleOverview = {
  status?: string;
  tenant?: { isActive?: boolean; billingStatus?: string };
  backup?: { count?: number };
  actions?: {
    canSnapshot?: boolean;
    canArchive?: boolean;
    canDeactivate?: boolean;
    canReactivate?: boolean;
    canClonePreview?: boolean;
  };
};

export async function getV3Billing() {
  return apiFetch<{ success: boolean; billing: V3BillingOverview }>('/api/v3/billing');
}

export async function getV3Subscription() {
  return apiFetch<{ success: boolean; subscription: V3SubscriptionOverview }>('/api/v3/subscription');
}

export async function updateV3Subscription(data: { tier?: string; maxUsers?: number; maxPhoneNumbers?: number }) {
  return apiFetch<{ success: boolean; subscription: V3SubscriptionOverview }>('/api/v3/subscription', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getV3License() {
  return apiFetch<{ success: boolean; license: V3LicenseOverview }>('/api/v3/license');
}

export async function getV3Backups() {
  return apiFetch<{ success: boolean; items: V3BackupItem[]; total: number }>('/api/v3/backup');
}

export async function createV3Backup(label?: string) {
  return apiFetch<{ success: boolean; backup: { id: string; label: string; itemCounts: Record<string, number> } }>('/api/v3/backup/create', {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export async function previewV3Restore(backupId: string) {
  return apiFetch<{ success: boolean; preview: Record<string, unknown> }>('/api/v3/backup/restore-preview', {
    method: 'POST',
    body: JSON.stringify({ backupId }),
  });
}

export async function restoreV3Backup(backupId: string, apply = false) {
  return apiFetch<{ success: boolean; result: V3RestoreResult }>('/api/v3/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ backupId, apply, dryRun: !apply }),
  });
}

export async function getV3Lifecycle() {
  return apiFetch<{ success: boolean; lifecycle: V3LifecycleOverview }>('/api/v3/lifecycle');
}

export async function runV3LifecycleAction(action: string, body: Record<string, unknown> = {}) {
  return apiFetch<{ success: boolean; result: Record<string, unknown> }>('/api/v3/lifecycle', {
    method: 'POST',
    body: JSON.stringify({ action, ...body }),
  });
}

export async function exportV3Configuration(format: 'json' | 'csv' | 'zip' = 'json') {
  const { getToken } = await import('./api');
  const token = getToken();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${API_URL}/api/v3/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ format }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const ext = format === 'zip' ? 'zip' : format;
  const filename = match?.[1] || `tenant-export.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importV3Configuration(payload: Record<string, unknown>, apply = false) {
  return apiFetch<{ success: boolean; validation: Record<string, unknown>; result: Record<string, unknown> }>('/api/v3/import', {
    method: 'POST',
    body: JSON.stringify({ payload, apply, dryRun: !apply }),
  });
}
