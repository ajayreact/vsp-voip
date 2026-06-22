import 'package:vsp_voip_mobile/core/network/response_parser.dart';

class CallRecording {
  const CallRecording({
    required this.id,
    required this.from,
    required this.to,
    required this.direction,
    required this.recordingUrl,
    this.durationSeconds,
    required this.createdAt,
  });

  final String id;
  final String from;
  final String to;
  final String direction;
  final String recordingUrl;
  final int? durationSeconds;
  final DateTime createdAt;

  factory CallRecording.fromJson(Map<String, dynamic> json) {
    return CallRecording(
      id: json['id'] as String,
      from: json['from'] as String? ?? '',
      to: json['to'] as String? ?? '',
      direction: json['direction'] as String? ?? 'unknown',
      recordingUrl: json['recordingUrl'] as String? ?? '',
      durationSeconds: json['durationSeconds'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class RecordingsResponse {
  const RecordingsResponse({
    required this.count,
    required this.recordings,
  });

  final int count;
  final List<CallRecording> recordings;

  factory RecordingsResponse.fromJson(Map<String, dynamic> json) {
    return RecordingsResponse(
      count: json['count'] as int? ?? 0,
      recordings: parseList(json['recordings'], CallRecording.fromJson),
    );
  }
}
