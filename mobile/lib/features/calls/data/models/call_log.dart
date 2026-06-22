import 'package:vsp_voip_mobile/core/network/response_parser.dart';

class CallLogEntry {
  const CallLogEntry({
    required this.id,
    required this.callSid,
    required this.from,
    required this.to,
    required this.direction,
    required this.status,
    this.durationSeconds,
    this.durationLabel,
    required this.createdAt,
    this.recordingId,
    this.recordingUrl,
  });

  final String id;
  final String callSid;
  final String from;
  final String to;
  final String direction;
  final String status;
  final int? durationSeconds;
  final String? durationLabel;
  final DateTime createdAt;
  final String? recordingId;
  final String? recordingUrl;

  factory CallLogEntry.fromJson(Map<String, dynamic> json) {
    return CallLogEntry(
      id: json['id'] as String,
      callSid: json['callSid'] as String? ?? '',
      from: json['from'] as String? ?? '',
      to: json['to'] as String? ?? '',
      direction: json['direction'] as String? ?? 'unknown',
      status: json['status'] as String? ?? 'unknown',
      durationSeconds: json['durationSeconds'] as int?,
      durationLabel: json['durationLabel'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      recordingId: json['recordingId'] as String?,
      recordingUrl: json['recordingUrl'] as String?,
    );
  }
}

class CallHistoryResponse {
  const CallHistoryResponse({
    required this.count,
    required this.calls,
  });

  final int count;
  final List<CallLogEntry> calls;

  factory CallHistoryResponse.fromJson(Map<String, dynamic> json) {
    return CallHistoryResponse(
      count: json['count'] as int? ?? 0,
      calls: parseList(json['calls'], CallLogEntry.fromJson),
    );
  }
}
