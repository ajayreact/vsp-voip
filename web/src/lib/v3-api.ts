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
