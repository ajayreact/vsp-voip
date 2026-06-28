import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { TenantProfile } from '../api/types';

export async function fetchTenantProfile(): Promise<TenantProfile> {
  const response = await authorizedRequest<{ success?: boolean; profile: TenantProfile }>(
    endpoints.tenant.profile,
  );
  return response.profile;
}
