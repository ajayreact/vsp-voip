import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/config/app_typography.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/softphone/providers/softphone_controller.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';

/// Full-screen incoming call UI shown above every tab in [AppShell].
class IncomingCallOverlay extends ConsumerWidget {
  const IncomingCallOverlay({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(softphoneControllerProvider);
    if (state.uiState != SoftphoneUiState.incoming) {
      return const SizedBox.shrink();
    }

    final controller = ref.read(softphoneControllerProvider.notifier);
    final theme = Theme.of(context);

    return Material(
      color: Colors.black.withValues(alpha: 0.45),
      child: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: CorporateCard(
              accent: AppColors.royal,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.royal.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.phone_callback_rounded,
                      size: 36,
                      color: AppColors.royal,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Incoming call',
                    style: theme.textTheme.labelMedium,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    AppFormatters.formatPhone(state.incomingCallerNumber ?? ''),
                    style: AppTypography.mono(context, size: 22),
                    textAlign: TextAlign.center,
                  ),
                  if (state.incomingCallerName != null &&
                      state.incomingCallerName!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      state.incomingCallerName!,
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 24),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: controller.acceptIncoming,
                          icon: const Icon(Icons.call_rounded),
                          label: const Text('Answer'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: controller.declineIncoming,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.danger,
                            side: const BorderSide(color: AppColors.danger),
                          ),
                          icon: const Icon(Icons.call_end_rounded),
                          label: const Text('Decline'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
