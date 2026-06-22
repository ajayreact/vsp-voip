import 'package:flutter_test/flutter_test.dart';
import 'package:vsp_voip_mobile/features/softphone/dial_normalization.dart';

void main() {
  group('internal extension dial (2–6 digits)', () {
    for (final ext in ['101', '102', '103', '10', '123456']) {
      test('$ext stays raw digits without + prefix', () {
        expect(normalizeDialableNumber(ext), ext);
        expect(isInternalExtensionDial(ext), isTrue);
      });
    }

    test('strips formatting but keeps extension digits', () {
      expect(normalizeDialableNumber(' 102 '), '102');
      expect(normalizeDialableNumber('ext:103'), '103');
    });

    test('+102 is treated as internal extension, not E.164', () {
      expect(normalizeDialableNumber('+102'), '102');
    });
  });

  group('PSTN E.164 normalization', () {
    test('10-digit US number gets +1 prefix', () {
      expect(normalizeDialableNumber('5551234567'), '+15551234567');
    });

    test('11-digit US number gets + prefix', () {
      expect(normalizeDialableNumber('15551234567'), '+15551234567');
    });

    test('explicit E.164 is preserved', () {
      expect(normalizeDialableNumber('+15551234567'), '+15551234567');
    });
  });

  group('invalid / non-dialable', () {
    test('single digit is not internal or PSTN', () {
      expect(isInternalExtensionDial('1'), isFalse);
      expect(normalizeDialableNumber('1'), isNull);
    });

    test('7-digit local code is not internal extension', () {
      expect(isInternalExtensionDial('5551234'), isFalse);
      expect(normalizeDialableNumber('5551234'), isNull);
    });
  });

  group('formatDisplayNumber', () {
    test('shows ext label for internal destinations', () {
      expect(formatDisplayNumber('102'), 'ext 102');
    });
  });
}
