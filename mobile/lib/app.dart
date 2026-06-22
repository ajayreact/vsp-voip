import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/config/app_theme.dart';
import 'package:vsp_voip_mobile/core/push/app_lifecycle_bridge.dart';
import 'package:vsp_voip_mobile/routing/app_router.dart';

class VspVoipApp extends ConsumerWidget {
  const VspVoipApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return AuthBootstrap(
      child: AppLifecycleBridge(
        child: MaterialApp.router(
          title: 'VSP-VOIP',
          theme: AppTheme.light(),
          routerConfig: router,
          debugShowCheckedModeBanner: false,
        ),
      ),
    );
  }
}
