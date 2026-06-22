import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/config/app_typography.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/sms/providers/sms_providers.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_shell.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/empty_state.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';

class SmsInboxScreen extends ConsumerWidget {
  const SmsInboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationsAsync = ref.watch(smsConversationsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppPageHeader(
        title: 'SMS inbox',
        subtitle: 'Business messaging',
        actions: [
          IconButton(
            onPressed: () =>
                ref.read(smsConversationsProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(smsConversationsProvider.notifier).refresh(),
        child: conversationsAsync.when(
          loading: () => const LoadingView(message: 'Loading conversations…'),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.5,
                child: ErrorView(
                  error: error,
                  onRetry: () =>
                      ref.read(smsConversationsProvider.notifier).refresh(),
                ),
              ),
            ],
          ),
          data: (conversations) {
            if (conversations.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.sms_outlined,
                    title: 'No conversations',
                    subtitle:
                        'SMS threads with your business numbers will appear here.',
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              itemCount: conversations.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final conversation = conversations[index];
                final preview = conversation.lastMessage.body;
                final hasUnread = conversation.unreadCount > 0;

                return CorporateCard(
                  padding: const EdgeInsets.all(16),
                  accent: hasUnread ? AppColors.royal : null,
                  onTap: () => context.openSmsThread(
                    peer: conversation.peer,
                    line: conversation.line,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: hasUnread
                            ? AppColors.royal.withValues(alpha: 0.12)
                            : AppColors.slate100,
                        child: Icon(
                          Icons.person_rounded,
                          color: hasUnread
                              ? AppColors.royal
                              : AppColors.slate400,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              AppFormatters.formatPhone(conversation.peer),
                              style: AppTypography.mono(
                                context,
                                size: 15,
                                color: hasUnread
                                    ? AppColors.slate900
                                    : AppColors.slate600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              preview,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontWeight:
                                    hasUnread ? FontWeight.w600 : FontWeight.w400,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            AppFormatters.formatRelativeTime(
                              conversation.lastMessage.createdAt,
                            ),
                            style: theme.textTheme.labelSmall,
                          ),
                          if (hasUnread) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.royal,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${conversation.unreadCount}',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
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
