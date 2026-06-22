import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';

abstract final class AppTypography {
  static TextTheme textTheme(ColorScheme scheme) {
    final display = GoogleFonts.soraTextTheme();
    final body = GoogleFonts.dmSansTextTheme();

    return TextTheme(
      displayLarge: display.displayLarge?.copyWith(
        fontWeight: FontWeight.w700,
        color: AppColors.slate900,
        letterSpacing: -1.2,
      ),
      displayMedium: display.displayMedium?.copyWith(
        fontWeight: FontWeight.w700,
        color: AppColors.slate900,
        letterSpacing: -0.8,
      ),
      displaySmall: display.displaySmall?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.slate900,
      ),
      headlineLarge: display.headlineLarge?.copyWith(
        fontWeight: FontWeight.w700,
        color: AppColors.slate900,
      ),
      headlineMedium: display.headlineMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.slate900,
      ),
      headlineSmall: display.headlineSmall?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.slate900,
      ),
      titleLarge: body.titleLarge?.copyWith(
        fontWeight: FontWeight.w700,
        color: AppColors.slate900,
      ),
      titleMedium: body.titleMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.slate900,
      ),
      titleSmall: body.titleSmall?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.slate600,
      ),
      bodyLarge: body.bodyLarge?.copyWith(color: AppColors.slate900),
      bodyMedium: body.bodyMedium?.copyWith(color: AppColors.slate600),
      bodySmall: body.bodySmall?.copyWith(color: AppColors.slate400),
      labelLarge: body.labelLarge?.copyWith(
        fontWeight: FontWeight.w600,
        letterSpacing: 0.2,
      ),
      labelMedium: body.labelMedium?.copyWith(
        fontWeight: FontWeight.w600,
        color: AppColors.slate600,
        letterSpacing: 0.4,
      ),
      labelSmall: body.labelSmall?.copyWith(
        fontWeight: FontWeight.w500,
        color: AppColors.slate400,
        letterSpacing: 0.5,
      ),
    ).apply(bodyColor: scheme.onSurface, displayColor: scheme.onSurface);
  }

  static TextStyle mono(BuildContext context, {double? size, Color? color}) {
    return GoogleFonts.jetBrainsMono(
      fontSize: size ?? 16,
      fontWeight: FontWeight.w500,
      color: color ?? AppColors.slate900,
      letterSpacing: 0.5,
    );
  }
}
