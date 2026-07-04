import { useQuery } from '@tanstack/react-query';
import { fetchSoftphoneDiagnostics } from '../settings/diagnosticsService';

export const SETTINGS_DIAGNOSTICS_KEY = ['settings', 'diagnostics'] as const;

export function useSettingsDiagnostics(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_DIAGNOSTICS_KEY,
    queryFn: fetchSoftphoneDiagnostics,
    enabled,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnReconnect: true,
  });
}
