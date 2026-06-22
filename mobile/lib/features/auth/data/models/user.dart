class User {
  const User({
    required this.id,
    required this.email,
    required this.name,
    required this.role,
    this.tenantId,
    this.tenantName,
    this.tenantContactEmail,
    this.tenantTimezone,
  });

  final String id;
  final String email;
  final String name;
  final String role;
  final String? tenantId;
  final String? tenantName;
  final String? tenantContactEmail;
  final String? tenantTimezone;

  bool get hasTenant => tenantId != null && tenantId!.isNotEmpty;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      name: json['name'] as String? ?? '',
      role: json['role'] as String? ?? 'TENANT_USER',
      tenantId: json['tenantId'] as String?,
      tenantName: json['tenantName'] as String?,
      tenantContactEmail: json['tenantContactEmail'] as String?,
      tenantTimezone: json['tenantTimezone'] as String?,
    );
  }
}

class LoginResponse {
  const LoginResponse({
    required this.accessToken,
    required this.user,
  });

  final String accessToken;
  final User user;

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      accessToken: json['accessToken'] as String,
      user: User.fromJson(Map<String, dynamic>.from(json['user'] as Map)),
    );
  }
}
