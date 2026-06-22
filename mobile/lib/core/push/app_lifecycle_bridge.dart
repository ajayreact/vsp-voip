import 'package:flutter/widgets.dart';
import 'package:vsp_voip_mobile/core/push/push_call_coordinator.dart';

/// Telnyx background pattern: disconnect WebRTC socket when app backgrounds so
/// push becomes the primary wake mechanism for inbound calls.
class AppLifecycleBridge extends StatefulWidget {
  const AppLifecycleBridge({super.key, required this.child});

  final Widget child;

  @override
  State<AppLifecycleBridge> createState() => _AppLifecycleBridgeState();
}

class _AppLifecycleBridgeState extends State<AppLifecycleBridge>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
      case AppLifecycleState.hidden:
        PushCallCoordinator.instance.notifyAppBackground();
      case AppLifecycleState.resumed:
        PushCallCoordinator.instance.notifyAppResumed();
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
