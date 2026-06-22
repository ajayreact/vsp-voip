import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vsp_voip_mobile/features/auth/providers/auth_providers.dart';
import 'package:vsp_voip_mobile/features/auth/presentation/login_screen.dart';
import 'package:vsp_voip_mobile/features/auth/presentation/scan_qr_screen.dart';
import 'package:vsp_voip_mobile/features/calls/presentation/call_history_screen.dart';
import 'package:vsp_voip_mobile/features/dashboard/presentation/dashboard_screen.dart';
import 'package:vsp_voip_mobile/features/profile/presentation/profile_screen.dart';
import 'package:vsp_voip_mobile/features/recordings/presentation/recordings_screen.dart';
import 'package:vsp_voip_mobile/features/softphone/presentation/softphone_screen.dart';
import 'package:vsp_voip_mobile/features/sms/presentation/sms_inbox_screen.dart';
import 'package:vsp_voip_mobile/features/sms/presentation/sms_thread_screen.dart';
import 'package:vsp_voip_mobile/features/voicemail/presentation/voicemail_screen.dart';
import 'package:vsp_voip_mobile/features/softphone/providers/softphone_controller.dart';
import 'package:vsp_voip_mobile/routing/app_routes.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_shell.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';

class RouterRefresh extends ChangeNotifier {
  RouterRefresh(this._ref) {
    _ref.listen(authControllerProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = RouterRefresh(ref);

  return GoRouter(
    initialLocation: AppRoutes.bootstrap,
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final location = state.matchedLocation;
      final isLogin = location == AppRoutes.login;
      final isScanQr = location == AppRoutes.scanQr;
      final isBootstrap = location == AppRoutes.bootstrap;

      if (auth.isLoading) {
        return isBootstrap ? null : AppRoutes.bootstrap;
      }

      if (isBootstrap) {
        return auth.asData?.value != null
            ? AppRoutes.dashboard
            : AppRoutes.login;
      }

      final loggedIn = auth.asData?.value != null;

      if (!loggedIn) {
        return (isLogin || isScanQr) ? null : AppRoutes.login;
      }

      if (isLogin) {
        return AppRoutes.dashboard;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.bootstrap,
        builder: (context, state) => const Scaffold(
          body: LoadingView(message: 'Starting VSP-VOIP…'),
        ),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.scanQr,
        builder: (context, state) => const ScanQrScreen(),
      ),
      GoRoute(
        path: AppRoutes.voicemail,
        builder: (context, state) => const VoicemailScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return AppShell(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.dashboard,
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.softphone,
                builder: (context, state) => const SoftphoneScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.calls,
                builder: (context, state) => const CallHistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.sms,
                builder: (context, state) => const SmsInboxScreen(),
                routes: [
                  GoRoute(
                    path: 'thread',
                    builder: (context, state) {
                      final peer = state.uri.queryParameters['peer'] ?? '';
                      final line = state.uri.queryParameters['line'] ?? '';
                      return SmsThreadScreen(peer: peer, line: line);
                    },
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.recordings,
                builder: (context, state) => const RecordingsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});

class AuthBootstrap extends ConsumerWidget {
  const AuthBootstrap({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(authControllerProvider, (previous, next) {
      final user = next.asData?.value;
      if (user != null && user.hasTenant) {
        ref.read(softphoneControllerProvider.notifier).ensureConnected();
      }
    });

    return child;
  }
}
