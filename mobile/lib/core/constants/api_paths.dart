class ApiPaths {
  static const authLogin = '/api/auth/login';
  static const authMe = '/api/auth/me';
  static const mobileProvision = '/api/mobile/provision';
  static const dashboardStats = '/api/dashboard/stats';
  static const calls = '/api/calls';
  static const tenantProfile = '/api/tenant/profile';
  static const smsConversations = '/api/sms/conversations';
  static const smsMessages = '/api/sms/messages';
  static const tenantRecordings = '/api/tenant/recordings';

  static String tenantRecordingStream(String id) =>
      '/api/tenant/recordings/$id/stream';
  static const softphoneConfig = '/api/softphone/config';
  static const softphoneToken = '/api/softphone/token';
  static const softphonePresence = '/api/softphone/presence';
  static const softphoneCallLog = '/api/softphone/call-log';
  static const softphoneRecordStart = '/api/softphone/record-start';
  static const softphonePushToken = '/api/softphone/push-token';
  static const softphoneDevices = '/api/softphone/devices';
  static const tenantVoicemails = '/api/tenant/voicemails';

  static String softphoneDevice(String deviceId) =>
      '/api/softphone/devices/$deviceId';
  static String tenantVoicemailRead(String id) =>
      '/api/tenant/voicemails/$id/read';
}
