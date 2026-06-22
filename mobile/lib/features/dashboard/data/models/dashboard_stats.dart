import 'package:vsp_voip_mobile/core/network/response_parser.dart';

class DashboardStats {
  const DashboardStats({
    required this.callCount,
    required this.numberCount,
    required this.unreadVoicemailCount,
    required this.unreadSmsCount,
    required this.pendingOrdersCount,
    required this.recentCalls,
  });

  final int callCount;
  final int numberCount;
  final int unreadVoicemailCount;
  final int unreadSmsCount;
  final int pendingOrdersCount;
  final List<RecentCall> recentCalls;

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    return DashboardStats(
      callCount: json['callCount'] as int? ?? 0,
      numberCount: json['numberCount'] as int? ?? 0,
      unreadVoicemailCount: json['unreadVoicemailCount'] as int? ?? 0,
      unreadSmsCount: json['unreadSmsCount'] as int? ?? 0,
      pendingOrdersCount: json['pendingOrdersCount'] as int? ?? 0,
      recentCalls: parseList(json['recentCalls'], RecentCall.fromJson),
    );
  }
}

class RecentCall {
  const RecentCall({
    required this.id,
    required this.from,
    required this.to,
    required this.direction,
    required this.status,
    this.durationSeconds,
    required this.createdAt,
  });

  final String id;
  final String from;
  final String to;
  final String direction;
  final String status;
  final int? durationSeconds;
  final DateTime createdAt;

  factory RecentCall.fromJson(Map<String, dynamic> json) {
    return RecentCall(
      id: json['id'] as String? ?? '',
      from: json['from'] as String? ?? '',
      to: json['to'] as String? ?? '',
      direction: json['direction'] as String? ?? 'unknown',
      status: json['status'] as String? ?? 'unknown',
      durationSeconds: json['durationSeconds'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
