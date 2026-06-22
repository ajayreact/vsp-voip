class TenantProfile {
  const TenantProfile({
    required this.id,
    required this.name,
    required this.contactEmail,
    required this.timezone,
  });

  final String id;
  final String name;
  final String contactEmail;
  final String timezone;

  factory TenantProfile.fromJson(Map<String, dynamic> json) {
    return TenantProfile(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      contactEmail: json['contactEmail'] as String? ?? '',
      timezone: json['timezone'] as String? ?? 'America/New_York',
    );
  }
}

class TenantProfileResponse {
  const TenantProfileResponse({required this.profile});

  final TenantProfile profile;

  factory TenantProfileResponse.fromJson(Map<String, dynamic> json) {
    return TenantProfileResponse(
      profile: TenantProfile.fromJson(
        Map<String, dynamic>.from(json['profile'] as Map),
      ),
    );
  }
}
