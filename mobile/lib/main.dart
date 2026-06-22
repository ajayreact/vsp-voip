import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/app.dart';
import 'package:vsp_voip_mobile/core/push/push_bootstrap.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await bootstrapPushServices();
  runApp(
    const ProviderScope(
      child: VspVoipApp(),
    ),
  );
}