import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:vsp_voip_mobile/config/api_config.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/auth/providers/auth_providers.dart';
import 'package:vsp_voip_mobile/features/profile/providers/profile_providers.dart';
import 'package:vsp_voip_mobile/routing/app_routes.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/section_header.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).asData?.value;
    final profileAsync = ref.watch(tenantProfileProvider);
    final theme = Theme.of(context);

    Future<void> logout() async {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Sign out'),
          content: const Text('Are you sure you want to sign out?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sign out'),
            ),
          ],
        ),
      );

      if (confirmed != true) return;

      await ref.read(authControllerProvider.notifier).logout();
      if (context.mounted) context.go(AppRoutes.login);
    }

    return Scaffold(
      appBar: AppPageHeader(
        title: 'Profile',
        subtitle: user?.email,
        actions: [
          IconButton(
            onPressed: () async {
              await ref.read(authControllerProvider.notifier).refreshProfile();
              ref.read(tenantProfileProvider.notifier).refresh();
            },
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: user == null
          ? const LoadingView(message: 'Loading profile…')
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                CorporateCard(
                  accent: AppColors.royal,
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 34,
                        backgroundColor: AppColors.royal.withValues(alpha: 0.12),
                        child: Text(
                          user.name.isNotEmpty
                              ? user.name[0].toUpperCase()
                              : '?',
                          style: theme.textTheme.headlineMedium?.copyWith(
                            color: AppColors.royal,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.name,
                              style: theme.textTheme.titleLarge,
                            ),
                            const SizedBox(height: 4),
                            Text(user.email, style: theme.textTheme.bodyMedium),
                            const SizedBox(height: 8),
                            Chip(
                              label: Text(AppFormatters.formatRole(user.role)),
                              backgroundColor:
                                  AppColors.navy.withValues(alpha: 0.08),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const SectionHeader(title: 'Organization'),
                profileAsync.when(
                  loading: () => const CorporateCard(
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (error, _) => CorporateCard(
                    child: ErrorView(
                      error: error,
                      onRetry: () =>
                          ref.read(tenantProfileProvider.notifier).refresh(),
                    ),
                  ),
                  data: (profile) {
                    if (profile == null) {
                      return CorporateCard(
                        child: Row(
                          children: [
                            const Icon(Icons.business_outlined),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    user.tenantName ?? 'No organization',
                                    style: theme.textTheme.titleSmall,
                                  ),
                                  Text(
                                    'This account is not linked to a tenant organization.',
                                    style: theme.textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    return CorporateCard(
                      child: Column(
                        children: [
                          _InfoRow(
                            icon: Icons.business_rounded,
                            title: profile.name,
                            subtitle: 'Company name',
                          ),
                          const Divider(),
                          _InfoRow(
                            icon: Icons.alternate_email_rounded,
                            title: profile.contactEmail.isEmpty
                                ? '—'
                                : profile.contactEmail,
                            subtitle: 'Contact email',
                          ),
                          const Divider(),
                          _InfoRow(
                            icon: Icons.schedule_rounded,
                            title: profile.timezone,
                            subtitle: 'Timezone',
                          ),
                        ],
                      ),
                    );
                  },
                ),
                const SizedBox(height: 20),
                const SectionHeader(title: 'Application'),
                CorporateCard(
                  child: _InfoRow(
                    icon: Icons.dns_rounded,
                    title: ApiConfig.baseUrl,
                    subtitle: 'API server',
                  ),
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: logout,
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Sign out'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                    minimumSize: const Size.fromHeight(52),
                  ),
                ),
              ],
            ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, color: AppColors.royal),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: theme.textTheme.titleSmall),
                Text(subtitle, style: theme.textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
