import 'package:flutter/material.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.action,
  });

  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: theme.textTheme.labelMedium?.copyWith(
                color: AppColors.slate400,
                letterSpacing: 1.2,
              ),
            ),
          ),
          if (action != null) action!,
        ],
      ),
    );
  }
}
