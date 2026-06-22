import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/features/softphone/providers/softphone_controller.dart';
import 'package:vsp_voip_mobile/routing/app_routes.dart';
import 'package:vsp_voip_mobile/shared/widgets/incoming_call_overlay.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onTap(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(softphoneControllerProvider);

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          navigationShell,
          const IncomingCallOverlay(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.slate200)),
          boxShadow: [
            BoxShadow(
              color: Color(0x0A0B1F3A),
              blurRadius: 16,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: NavigationBar(
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: _onTap,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.space_dashboard_outlined),
                selectedIcon: Icon(Icons.space_dashboard_rounded),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Icon(Icons.dialpad_outlined),
                selectedIcon: Icon(Icons.dialpad_rounded),
                label: 'Phone',
              ),
              NavigationDestination(
                icon: Icon(Icons.history_toggle_off_rounded),
                selectedIcon: Icon(Icons.history_rounded),
                label: 'Calls',
              ),
              NavigationDestination(
                icon: Icon(Icons.chat_bubble_outline_rounded),
                selectedIcon: Icon(Icons.chat_bubble_rounded),
                label: 'SMS',
              ),
              NavigationDestination(
                icon: Icon(Icons.graphic_eq_outlined),
                selectedIcon: Icon(Icons.graphic_eq_rounded),
                label: 'Rec',
              ),
              NavigationDestination(
                icon: Icon(Icons.account_circle_outlined),
                selectedIcon: Icon(Icons.account_circle_rounded),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

extension AppNavigation on BuildContext {
  void goToDashboard() => go(AppRoutes.dashboard);
  void goToSoftphone() => go(AppRoutes.softphone);
  void goToCalls() => go(AppRoutes.calls);
  void goToSms() => go(AppRoutes.sms);
  void goToRecordings() => go(AppRoutes.recordings);
  void goToProfile() => go(AppRoutes.profile);

  void openSmsThread({required String peer, required String line}) {
    push(
      '${AppRoutes.sms}/thread?peer=${Uri.encodeComponent(peer)}&line=${Uri.encodeComponent(line)}',
    );
  }
}
