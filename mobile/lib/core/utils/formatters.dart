import 'package:intl/intl.dart';

class AppFormatters {
  static final _timeFormat = DateFormat.jm();
  static final _dateFormat = DateFormat.MMMd();
  static final _dateTimeFormat = DateFormat('MMM d, y · h:mm a');
  static final _durationFormat = DateFormat('mm:ss');

  static String formatRelativeTime(DateTime dateTime) {
    final now = DateTime.now();
    if (now.difference(dateTime).inDays == 0 &&
        dateTime.day == now.day &&
        dateTime.month == now.month &&
        dateTime.year == now.year) {
      return _timeFormat.format(dateTime);
    }
    if (now.difference(dateTime).inDays < 7) {
      return _dateFormat.format(dateTime);
    }
    return _dateTimeFormat.format(dateTime);
  }

  static String formatDateTime(DateTime dateTime) =>
      _dateTimeFormat.format(dateTime);

  static String formatDuration(int? seconds) {
    if (seconds == null || seconds <= 0) return '—';
    final duration = Duration(seconds: seconds);
    if (duration.inHours > 0) {
      return '${duration.inHours}:${_durationFormat.format(DateTime(0).add(duration))}';
    }
    return _durationFormat.format(DateTime(0).add(duration));
  }

  static String formatPhone(String? value) {
    if (value == null || value.isEmpty) return 'Unknown';
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 11 && digits.startsWith('1')) {
      final core = digits.substring(1);
      return '+1 (${core.substring(0, 3)}) ${core.substring(3, 6)}-${core.substring(6)}';
    }
    if (digits.length == 10) {
      return '(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}';
    }
    return value;
  }

  static String formatRole(String role) {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super admin';
      case 'TENANT_ADMIN':
        return 'Admin';
      case 'TENANT_USER':
        return 'User';
      default:
        return role;
    }
  }

  static String formatDirection(String? direction) {
    switch (direction?.toLowerCase()) {
      case 'inbound':
        return 'Inbound';
      case 'outbound':
        return 'Outbound';
      default:
        return direction ?? 'Unknown';
    }
  }

  static String formatCallStatus(String? status) {
    if (status == null || status.isEmpty) return 'Unknown';
    return status
        .split('_')
        .map((part) =>
            part.isEmpty ? part : '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }
}
