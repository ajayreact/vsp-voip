import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/sms/providers/sms_providers.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/empty_state.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';

class SmsThreadScreen extends ConsumerWidget {
  const SmsThreadScreen({
    super.key,
    required this.peer,
    required this.line,
  });

  final String peer;
  final String line;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (peer.isEmpty || line.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Conversation')),
        body: const EmptyState(
          icon: Icons.sms_failed_outlined,
          title: 'Invalid conversation',
          subtitle: 'Missing peer or line number.',
        ),
      );
    }

    final threadKey = (peer: peer, line: line);
    final messagesAsync = ref.watch(smsThreadProvider(threadKey));
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppPageHeader(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
        title: AppFormatters.formatPhone(peer),
        subtitle: 'via ${AppFormatters.formatPhone(line)}',
        actions: [
          IconButton(
            onPressed: () =>
                ref.read(smsThreadProvider(threadKey).notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(smsThreadProvider(threadKey).notifier).refresh(),
        child: messagesAsync.when(
          loading: () => const LoadingView(),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.5,
                child: ErrorView(
                  error: error,
                  onRetry: () => ref
                      .read(smsThreadProvider(threadKey).notifier)
                      .refresh(),
                ),
              ),
            ],
          ),
          data: (messages) {
            if (messages.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.chat_bubble_outline,
                    title: 'No messages',
                    subtitle: 'This conversation is empty.',
                  ),
                ],
              );
            }

            return ListView.builder(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final message = messages[index];
                final isInbound = message.isInbound;

                return Align(
                  alignment:
                      isInbound ? Alignment.centerLeft : Alignment.centerRight,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                    ),
                    decoration: BoxDecoration(
                      color: isInbound
                          ? Colors.white
                          : AppColors.royal.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(18),
                        topRight: const Radius.circular(18),
                        bottomLeft: Radius.circular(isInbound ? 4 : 18),
                        bottomRight: Radius.circular(isInbound ? 18 : 4),
                      ),
                      border: Border.all(
                        color: isInbound
                            ? AppColors.slate200
                            : AppColors.royal.withValues(alpha: 0.2),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(message.body),
                        const SizedBox(height: 4),
                        Text(
                          AppFormatters.formatRelativeTime(message.createdAt),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
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
