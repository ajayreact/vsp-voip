import 'package:flutter/material.dart';

/// Corporate palette for VSP-VOIP mobile.
abstract final class AppColors {
  static const navy = Color(0xFF0B1F3A);
  static const navyLight = Color(0xFF163A63);
  static const royal = Color(0xFF1D6FD8);
  static const sky = Color(0xFF38BDF8);
  static const slate50 = Color(0xFFF8FAFC);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate400 = Color(0xFF94A3B8);
  static const slate600 = Color(0xFF475569);
  static const slate900 = Color(0xFF0F172A);
  static const success = Color(0xFF059669);
  static const warning = Color(0xFFD97706);
  static const danger = Color(0xFFDC2626);

  static const heroGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [navy, navyLight, Color(0xFF1E4A7A)],
  );

  static const accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [royal, sky],
  );
}
