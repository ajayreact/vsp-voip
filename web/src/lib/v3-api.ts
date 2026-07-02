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
