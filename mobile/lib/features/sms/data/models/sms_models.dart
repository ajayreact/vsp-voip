import 'package:vsp_voip_mobile/core/network/response_parser.dart';

class SmsMessage {
  const SmsMessage({
    required this.id,
    required this.from,
    required this.to,
    required this.body,
    required this.direction,
    required this.status,
    required this.isRead,
    required this.createdAt,
  });

  final String id;
  final String from;
  final String to;
  final String body;
  final String direction;
  final String status;
  final bool isRead;
  final DateTime createdAt;

  bool get isInbound => direction.toLowerCase() == 'inbound';

  factory SmsMessage.fromJson(Map<String, dynamic> json) {
    return SmsMessage(
      id: json['id'] as String,
      from: json['from'] as String? ?? '',
      to: json['to'] as String? ?? '',
      body: json['body'] as String? ?? '',
      direction: json['direction'] as String? ?? 'unknown',
      status: json['status'] as String? ?? 'unknown',
      isRead: json['isRead'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class SmsConversation {
  const SmsConversation({
    required this.peer,
    required this.line,
    required this.lastMessage,
    required this.unreadCount,
  });

  final String peer;
  final String line;
  final SmsMessage lastMessage;
  final int unreadCount;

  factory SmsConversation.fromJson(Map<String, dynamic> json) {
    return SmsConversation(
      peer: json['peer'] as String? ?? '',
      line: json['line'] as String? ?? '',
      lastMessage: SmsMessage.fromJson(
        Map<String, dynamic>.from(json['lastMessage'] as Map),
      ),
      unreadCount: json['unreadCount'] as int? ?? 0,
    );
  }
}

class SmsConversationsResponse {
  const SmsConversationsResponse({
    required this.count,
    required this.conversations,
  });

  final int count;
  final List<SmsConversation> conversations;

  factory SmsConversationsResponse.fromJson(Map<String, dynamic> json) {
    return SmsConversationsResponse(
      count: json['count'] as int? ?? 0,
      conversations: parseList(json['conversations'], SmsConversation.fromJson),
    );
  }
}

class SmsMessagesResponse {
  const SmsMessagesResponse({
    required this.count,
    required this.messages,
  });

  final int count;
  final List<SmsMessage> messages;

  factory SmsMessagesResponse.fromJson(Map<String, dynamic> json) {
    return SmsMessagesResponse(
      count: json['count'] as int? ?? 0,
      messages: parseList(json['messages'], SmsMessage.fromJson),
    );
  }
}
