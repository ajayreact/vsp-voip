import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { CallLogEntry } from '../api/types';

export async function fetchRecentCalls(limit = 50): Promise<CallLogEntry[]> {
  const response = await authorizedRequest<{ success?: boolean; calls?: CallLogEntry[] }>(
    endpoints.calls.list(limit),
  );
  return response.calls ?? [];
}
