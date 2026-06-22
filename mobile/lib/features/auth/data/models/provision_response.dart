import 'package:vsp_voip_mobile/features/auth/data/models/user.dart';

class ProvisionExtensionConfig {
  const ProvisionExtensionConfig({
    required this.id,
    required this.extensionNumber,
    required this.displayName,
    this.department,
    this.voicemailEnabled = true,
    this.webrtcEnabled = true,
    this.sipEnabled = false,
    this.assignedNumbers = const [],
  });

  final String id;
  final String extensionNumber;
  final String displayName;
  final String? department;
  final bool voicemailEnabled;
  final bool webrtcEnabled;
  final bool sipEnabled;
  final List<Map<String, dynamic>> assignedNumbers;

  factory ProvisionExtensionConfig.fromJson(Map<String, dynamic> json) {
    return ProvisionExtensionConfig(
      id: json['id'] as String,
      extensionNumber: json['extensionNumber'] as String,
      displayName: json['displayName'] as String? ?? '',
      department: json['department'] as String?,
      voicemailEnabled: json['voicemailEnabled'] as bool? ?? true,
      webrtcEnabled: json['webrtcEnabled'] as bool? ?? true,
      sipEnabled: json['sipEnabled'] as bool? ?? false,
      assignedNumbers: (json['assignedNumbers'] as List<dynamic>? ?? [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'extensionNumber': extensionNumber,
        'displayName': displayName,
        'department': department,
        'voicemailEnabled': voicemailEnabled,
        'webrtcEnabled': webrtcEnabled,
        'sipEnabled': sipEnabled,
        'assignedNumbers': assignedNumbers,
      };
}

class ProvisionTelephonyConfig {
  const ProvisionTelephonyConfig({
    this.loginToken,
    this.sipUsername,
    this.credentialId,
    this.expiresInSeconds,
  });

  final String? loginToken;
  final String? sipUsername;
  final String? credentialId;
  final int? expiresInSeconds;

  factory ProvisionTelephonyConfig.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const ProvisionTelephonyConfig();
    return ProvisionTelephonyConfig(
      loginToken: json['loginToken'] as String?,
      sipUsername: json['sipUsername'] as String?,
      credentialId: json['credentialId'] as String?,
      expiresInSeconds: json['expiresInSeconds'] as int?,
    );
  }
}

class ProvisionResponse {
  const ProvisionResponse({
    required this.accessToken,
    required this.user,
    required this.extension,
    this.telephony,
  });

  final String accessToken;
  final User user;
  final ProvisionExtensionConfig extension;
  final ProvisionTelephonyConfig? telephony;

  factory ProvisionResponse.fromJson(Map<String, dynamic> json) {
    return ProvisionResponse(
      accessToken: json['accessToken'] as String,
      user: User.fromJson(Map<String, dynamic>.from(json['user'] as Map)),
      extension: ProvisionExtensionConfig.fromJson(
        Map<String, dynamic>.from(json['extension'] as Map),
      ),
      telephony: ProvisionTelephonyConfig.fromJson(
        json['telephony'] as Map<String, dynamic>?,
      ),
    );
  }
}
