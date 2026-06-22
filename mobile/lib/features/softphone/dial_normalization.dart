/// Shared dial normalization for Android and iOS (single Flutter codebase).
String? normalizeDialableNumber(String input) {
  final trimmed = input.trim();
  if (trimmed.isEmpty) return null;

  final digits = trimmed.replaceAll(RegExp(r'\D'), '');

  if (isInternalExtensionDial(trimmed)) {
    return digits;
  }

  if (trimmed.startsWith('+')) {
    return digits.isEmpty ? null : '+$digits';
  }

  if (digits.length == 10) return '+1$digits';
  if (digits.length == 11 && digits.startsWith('1')) return '+$digits';
  if (digits.length > 11) return '+$digits';
  return null;
}

bool isInternalExtensionDial(String input) {
  final digits = input.trim().replaceAll(RegExp(r'\D'), '');
  return RegExp(r'^\d{2,6}$').hasMatch(digits);
}

String formatDisplayNumber(String value) {
  if (RegExp(r'^\d{2,6}$').hasMatch(value)) {
    return 'ext $value';
  }
  if (value.startsWith('+1') && value.length == 12) {
    final core = value.substring(2);
    return '+1 (${core.substring(0, 3)}) ${core.substring(3, 6)}-${core.substring(6)}';
  }
  return value;
}
