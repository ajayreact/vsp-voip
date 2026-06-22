import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/config/app_typography.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/auth/providers/auth_providers.dart';
import 'package:vsp_voip_mobile/features/dashboard/providers/dashboard_providers.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_shell.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/empty_state.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/section_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/stat_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/welcome_hero.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).asData?.value;
    final statsAsync = ref.watch(dashboardStatsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppPageHeader(
        title: 'Dashboard',
        subtitle: user?.tenantName,
        actions: [
          IconButton(
            onPressed: () => ref.read(dashboardStatsProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(dashboardStatsProvider.notifier).refresh(),
        child: statsAsync.when(
          loading: () => const LoadingView(message: 'Loading workspace…'),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.5,
                child: ErrorView(
                  error: error,
                  onRetry: () =>
                      ref.read(dashboardStatsProvider.notifier).refresh(),
                ),
              ),
            ],
          ),
          data: (stats) {
            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                WelcomeHero(
                  greeting: 'Welcome back',
                  name: user?.name.split(' ').first ?? 'there',
                  organization: user?.tenantName,
                ),
                const SizedBox(height: 20),
                const SectionHeader(title: 'Overview'),
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.2,
                  children: [
                    StatCard(
                      label: 'Total calls',
                      value: '${stats.callCount}',
                      icon: Icons.call_rounded,
                    ),
                    StatCard(
                      label: 'Numbers',
                      value: '${stats.numberCount}',
                      icon: Icons.dialpad_rounded,
                      color: AppColors.navy,
                    ),
                    StatCard(
                      label: 'Unread SMS',
                      value: '${stats.unreadSmsCount}',
                      icon: Icons.mark_chat_unread_rounded,
                      color: AppColors.sky,
                    ),
                    StatCard(
                      label: 'Voicemail',
                      value: '${stats.unreadVoicemailCount}',
                      icon: Icons.voicemail_rounded,
                      color: AppColors.warning,
                    ),
                  ],
                ),
                if (stats.pendingOrdersCount > 0) ...[
                  const SizedBox(height: 16),
                  CorporateCard(
                    accent: AppColors.warning,
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        const Icon(Icons.shopping_bag_outlined),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${stats.pendingOrdersCount} pending order${stats.pendingOrdersCount == 1 ? '' : 's'}',
                                style: theme.textTheme.titleSmall,
                              ),
                              Text(
                                'Awaiting payment or fulfillment',
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                const SectionHeader(title: 'Recent calls'),
                if (stats.recentCalls.isEmpty)
                  const EmptyState(
                    icon: Icons.phone_disabled_outlined,
                    title: 'No calls yet',
                    subtitle: 'Recent activity will appear here.',
                  )
                else
                  ...stats.recentCalls.map(
                    (call) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: CorporateCard(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor:
                                  AppColors.royal.withValues(alpha: 0.12),
                              child: Icon(
                                call.direction.toLowerCase() == 'inbound'
                                    ? Icons.call_received_rounded
                                    : Icons.call_made_rounded,
                                color: AppColors.royal,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    AppFormatters.formatPhone(
                                      call.direction.toLowerCase() == 'inbound'
                                          ? call.from
                                          : call.to,
                                    ),
                                    style: AppTypography.mono(context),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${AppFormatters.formatDirection(call.direction)} · ${AppFormatters.formatCallStatus(call.status)}',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              AppFormatters.formatRelativeTime(call.createdAt),
                              style: theme.textTheme.labelSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
                const SectionHeader(title: 'Quick actions'),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.icon(
                      onPressed: () => context.goToSoftphone(),
                      icon: const Icon(Icons.dialpad_rounded),
                      label: const Text('Open phone'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => context.goToCalls(),
                      icon: const Icon(Icons.history_rounded),
                      label: const Text('Call history'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => context.goToSms(),
                      icon: const Icon(Icons.sms_rounded),
                      label: const Text('SMS inbox'),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
