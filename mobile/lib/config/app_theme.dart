import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/config/app_typography.dart';

class AppTheme {
  static ThemeData light() {
    const scheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.royal,
      onPrimary: Colors.white,
      primaryContainer: Color(0xFFDCEBFF),
      onPrimaryContainer: AppColors.navy,
      secondary: AppColors.navy,
      onSecondary: Colors.white,
      secondaryContainer: Color(0xFFE8EEF5),
      onSecondaryContainer: AppColors.navy,
      tertiary: AppColors.sky,
      onTertiary: AppColors.navy,
      tertiaryContainer: Color(0xFFE0F6FE),
      onTertiaryContainer: AppColors.navyLight,
      error: AppColors.danger,
      onError: Colors.white,
      errorContainer: Color(0xFFFEE2E2),
      onErrorContainer: Color(0xFF991B1B),
      surface: AppColors.slate50,
      onSurface: AppColors.slate900,
      onSurfaceVariant: AppColors.slate600,
      outline: AppColors.slate200,
      outlineVariant: AppColors.slate200,
      shadow: Color(0x1A0B1F3A),
      scrim: Colors.black54,
      inverseSurface: AppColors.navy,
      onInverseSurface: Colors.white,
      inversePrimary: AppColors.sky,
      surfaceTint: AppColors.royal,
      surfaceContainerHighest: AppColors.slate100,
      surfaceContainerHigh: Color(0xFFF8FAFC),
      surfaceContainer: Colors.white,
      surfaceContainerLow: Colors.white,
      surfaceContainerLowest: Colors.white,
      surfaceBright: Colors.white,
      surfaceDim: AppColors.slate100,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.slate50,
      textTheme: AppTypography.textTheme(scheme),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.slate900,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
        titleTextStyle: AppTypography.textTheme(scheme).titleLarge,
      ),
      cardTheme: CardTheme(
        elevation: 0,
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppColors.slate200),
        ),
        margin: EdgeInsets.zero,
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 0,
        height: 72,
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFDCEBFF),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final base = AppTypography.textTheme(scheme).labelSmall;
          if (states.contains(WidgetState.selected)) {
            return base?.copyWith(
              color: AppColors.royal,
              fontWeight: FontWeight.w700,
            );
          }
          return base?.copyWith(color: AppColors.slate400);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.royal, size: 24);
          }
          return const IconThemeData(color: AppColors.slate400, size: 24);
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.slate200),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.slate200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.royal, width: 1.5),
        ),
        labelStyle: AppTypography.textTheme(scheme).labelMedium,
        hintStyle: AppTypography.textTheme(scheme).bodyMedium,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.royal,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(52),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: AppTypography.textTheme(scheme).labelLarge?.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.navy,
          minimumSize: const Size.fromHeight(48),
          side: const BorderSide(color: AppColors.slate200),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: AppTypography.textTheme(scheme).labelLarge,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.slate100,
        labelStyle: AppTypography.textTheme(scheme).labelMedium,
        side: BorderSide.none,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.slate200,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: AppColors.navy,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.royal,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.royal,
        foregroundColor: Colors.white,
        elevation: 2,
      ),
    );
  }
}
