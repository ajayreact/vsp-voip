import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/core/errors/api_exception.dart';
import 'package:vsp_voip_mobile/features/auth/providers/auth_providers.dart';
import 'package:vsp_voip_mobile/routing/app_routes.dart';

class ScanQrScreen extends ConsumerStatefulWidget {
  const ScanQrScreen({super.key});

  @override
  ConsumerState<ScanQrScreen> createState() => _ScanQrScreenState();
}

class _ScanQrScreenState extends ConsumerState<ScanQrScreen> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates);
  bool _processing = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handlePayload(String raw) async {
    if (_processing) return;
    setState(() {
      _processing = true;
      _error = null;
    });

    try {
      String? token;
      final trimmed = raw.trim();
      if (trimmed.startsWith('{')) {
        final json = Map<String, dynamic>.from(jsonDecode(trimmed) as Map);
        token = json['token'] as String?;
      } else {
        final uri = Uri.tryParse(trimmed);
        token = uri?.queryParameters['token'];
      }

      if (token == null || token.isEmpty) {
        throw const ApiException('Invalid QR code');
      }

      await ref.read(authControllerProvider.notifier).provisionFromQr(token);
      if (!mounted) return;
      context.go(AppRoutes.dashboard);
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.navy,
      appBar: AppBar(
        title: const Text('Scan extension QR'),
        backgroundColor: AppColors.navy,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                MobileScanner(
                  controller: _controller,
                  onDetect: (capture) {
                    final value = capture.barcodes.firstOrNull?.rawValue;
                    if (value != null && value.isNotEmpty) {
                      _handlePayload(value);
                    }
                  },
                ),
                if (_processing)
                  Container(
                    color: Colors.black54,
                    child: const Center(
                      child: CircularProgressIndicator(color: Colors.white),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Point your camera at the QR code from the admin portal.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  'This signs you in, downloads extension settings, and registers WebRTC automatically.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.slate400),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
