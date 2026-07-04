import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { SoftphoneDevice } from './types';

export async function fetchSoftphoneDevices(): Promise<SoftphoneDevice[]> {
  const response = await authorizedRequest<{
    success?: boolean;
    devices?: SoftphoneDevice[];
  }>(endpoints.softphone.devices);
  return response.devices ?? [];
}

export async function removeSoftphoneDevice(deviceId: string): Promise<void> {
  await authorizedRequest<{ success?: boolean }>(endpoints.softphone.device(deviceId), {
    method: 'DELETE',
  });
}
