class VoicemailMessage {
  const VoicemailMessage({
    required this.id,
    required this.from,
    required this.to,
    required this.recordingUrl,
    required this.isRead,
    required this.createdAt,
    this.durationSeconds,
    this.callSid,
    this.recordingSid,
  });

  final String id;
  final String from;
  final String to;
  final String recordingUrl;
  final int? durationSeconds;
  final bool isRead;
  final DateTime createdAt;
  final String? callSid;
  final String? recordingSid;

  factory VoicemailMessage.fromJson(Map<String, dynamic> json) {
    return VoicemailMessage(
      id: json['id'] as String,
      from: json['from'] as String? ?? 'Unknown',
      to: json['to'] as String? ?? '',
      recordingUrl: json['recordingUrl'] as String? ?? '',
      durationSeconds: json['durationSeconds'] as int?,
      isRead: json['isRead'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      callSid: json['callSid'] as String?,
      recordingSid: json['recordingSid'] as String?,
    );
  }
}

class VoicemailListResponse {
  const VoicemailListResponse({
    required this.voicemails,
    required this.count,
  });

  final List<VoicemailMessage> voicemails;
  final int count;

  factory VoicemailListResponse.fromJson(Map<String, dynamic> json) {
    final raw = json['voicemails'];
    final list = raw is List
        ? raw
            .whereType<Map>()
            .map((item) => VoicemailMessage.fromJson(Map<String, dynamic>.from(item)))
            .toList()
        : <VoicemailMessage>[];
    return VoicemailListResponse(
      voicemails: list,
      count: json['count'] as int? ?? list.length,
    );
  }
}
