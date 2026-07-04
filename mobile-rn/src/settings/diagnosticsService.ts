import { endpoints } from '../api/endpoints';
import { authorizedRequest } from '../auth/authService';
import type { SoftphoneDiagnostics } from './types';

export async function fetchSoftphoneDiagnostics(): Promise<SoftphoneDiagnostics> {
  return authorizedRequest<SoftphoneDiagnostics>(endpoints.softphone.diagnostics);
}
