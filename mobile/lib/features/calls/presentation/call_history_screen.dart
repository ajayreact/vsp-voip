import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/config/app_typography.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/calls/providers/calls_providers.dart';
import 'package:vsp_voip_mobile/features/softphone/dial_normalization.dart';
import 'package:vsp_voip_mobile/features/softphone/providers/softphone_controller.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/routing/app_routes.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_shell.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/empty_state.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';

class CallHistoryScreen extends ConsumerWidget {
  const CallHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final callsAsync = ref.watch(callHistoryProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppPageHeader(
        title: 'Call history',
        subtitle: 'Tap any call to dial back',
        actions: [
          IconButton(
            tooltip: 'Voicemail',
            onPressed: () => context.push(AppRoutes.voicemail),
            icon: const Icon(Icons.voicemail_rounded),
          ),
          IconButton(
            onPressed: () => ref.read(callHistoryProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(callHistoryProvider.notifier).refresh(),
        child: callsAsync.when(
          loading: () => const LoadingView(message: 'Loading calls…'),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.5,
                child: ErrorView(
                  error: error,
                  onRetry: () =>
                      ref.read(callHistoryProvider.notifier).refresh(),
                ),
              ),
            ],
          ),
          data: (calls) {
            if (calls.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.history_rounded,
                    title: 'No call history',
                    subtitle:
                        'Inbound and outbound calls for your organization will show here.',
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              itemCount: calls.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final call = calls[index];
                final isInbound =
                    call.direction.toLowerCase() == 'inbound';
                final counterparty = isInbound ? call.from : call.to;
                final accent = isInbound ? AppColors.royal : AppColors.navy;

                return CorporateCard(
                  accent: accent,
                  padding: const EdgeInsets.all(16),
                  onTap: () {
                    final number = normalizeDialableNumber(counterparty);
                    if (number == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Cannot dial this number')),
                      );
                      return;
                    }
                    ref
                        .read(softphoneControllerProvider.notifier)
                        .callNumber(counterparty);
                    context.goToSoftphone();
                  },
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: accent.withValues(alpha: 0.12),
                        child: Icon(
                          isInbound
                              ? Icons.call_received_rounded
                              : Icons.call_made_rounded,
                          color: accent,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              AppFormatters.formatPhone(counterparty),
                              style: AppTypography.mono(context),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${AppFormatters.formatDirection(call.direction)} · ${AppFormatters.formatCallStatus(call.status)}',
                              style: theme.textTheme.bodySmall,
                            ),
                            Text(
                              AppFormatters.formatDateTime(call.createdAt),
                              style: theme.textTheme.labelSmall,
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            call.durationLabel ??
                                AppFormatters.formatDuration(
                                  call.durationSeconds,
                                ),
                            style: theme.textTheme.titleSmall,
                          ),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.royal.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.phone_rounded,
                              color: AppColors.royal,
                              size: 18,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
