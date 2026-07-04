import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { DashboardStats } from '../api/types';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return authorizedRequest<DashboardStats>(endpoints.dashboard.stats);
}
