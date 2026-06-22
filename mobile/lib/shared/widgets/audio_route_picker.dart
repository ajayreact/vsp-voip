import 'package:flutter/material.dart';
import 'package:telnyx_webrtc/call.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/core/audio/audio_route_service.dart';

Future<AudioRouteKind?> showAudioRoutePicker({
  required BuildContext context,
  required Call call,
  AudioRouteKind? selected,
}) async {
  final routes = await AudioRouteService.listRoutes();
  if (!context.mounted) return selected;

  return showModalBottomSheet<AudioRouteKind>(
    context: context,
    showDragHandle: true,
    builder: (context) {
      return SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text(
                'Audio output',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
            ...routes.map((route) {
              final icon = switch (route.kind) {
                AudioRouteKind.speaker => Icons.volume_up_rounded,
                AudioRouteKind.earpiece => Icons.phone_in_talk_rounded,
                AudioRouteKind.bluetooth => Icons.bluetooth_audio_rounded,
                AudioRouteKind.wired => Icons.headset_mic_rounded,
                AudioRouteKind.unknown => Icons.speaker_phone_rounded,
              };
              final isSelected = selected == route.kind;

              return ListTile(
                leading: Icon(
                  icon,
                  color: isSelected ? AppColors.royal : null,
                ),
                title: Text(route.label),
                trailing: isSelected
                    ? const Icon(Icons.check_rounded, color: AppColors.royal)
                    : null,
                onTap: () async {
                  await AudioRouteService.applyRoute(call, route: route);
                  if (context.mounted) Navigator.of(context).pop(route.kind);
                },
              );
            }),
            const SizedBox(height: 8),
          ],
        ),
      );
    },
  );
}
