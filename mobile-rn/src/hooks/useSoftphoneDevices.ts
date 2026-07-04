import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSoftphoneDevices, removeSoftphoneDevice } from '../settings/devicesService';
import type { SoftphoneDevice } from '../settings/types';

export const SOFTPHONE_DEVICES_KEY = ['settings', 'softphone-devices'] as const;

export function useSoftphoneDevices() {
  return useQuery({
    queryKey: SOFTPHONE_DEVICES_KEY,
    queryFn: fetchSoftphoneDevices,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useRemoveSoftphoneDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => removeSoftphoneDevice(deviceId),
    onSuccess: (_result, deviceId) => {
      queryClient.setQueryData<SoftphoneDevice[]>(SOFTPHONE_DEVICES_KEY, (current) =>
        current?.filter((device) => device.deviceId !== deviceId) ?? [],
      );
    },
  });
}
