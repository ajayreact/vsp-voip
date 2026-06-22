import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vsp_voip_mobile/app.dart';

void main() {
  testWidgets('App boots with login screen after auth check', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: VspVoipApp(),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('VSP-VOIP'), findsOneWidget);
  });
}
