export {
  fetchTenantProfile,
} from './settingsService';
export {
  fetchSoftphoneDevices,
  removeSoftphoneDevice,
} from './devicesService';
export { fetchSoftphoneDiagnostics } from './diagnosticsService';
export {
  formatDiagnosticsReport,
  formatPlatformLabel,
  resolveMyExtension,
} from './diagnosticsFormat';
export type {
  SoftphoneDevice,
  SoftphoneDiagnostics,
  LiveSettingsStatus,
  ClientSettingsPrefs,
} from './types';
