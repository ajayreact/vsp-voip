import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:vsp_voip_mobile/config/api_config.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/config/app_typography.dart';
import 'package:vsp_voip_mobile/core/constants/api_paths.dart';
import 'package:vsp_voip_mobile/core/storage/token_storage_provider.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/recordings/data/models/call_recording.dart';
import 'package:vsp_voip_mobile/features/recordings/providers/recordings_providers.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/empty_state.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';

class RecordingsScreen extends ConsumerStatefulWidget {
  const RecordingsScreen({super.key});

  @override
  ConsumerState<RecordingsScreen> createState() => _RecordingsScreenState();
}

class _RecordingsScreenState extends ConsumerState<RecordingsScreen> {
  final _player = AudioPlayer();
  String? _playingId;

  @override
  void initState() {
    super.initState();
    _player.playerStateStream.listen((playerState) {
      if (!mounted) return;
      if (playerState.processingState == ProcessingState.completed) {
        setState(() => _playingId = null);
      }
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  Future<void> _playRecording(CallRecording recording) async {
    if (_playingId == recording.id) {
      if (_player.playing) {
        await _player.pause();
      } else {
        await _player.play();
      }
      setState(() {});
      return;
    }

    final token = await ref.read(tokenStorageProvider).readToken();
    if (token == null || token.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please sign in again to play recordings')),
      );
      return;
    }

    try {
      await _player.stop();
      await _player.setAudioSource(
        AudioSource.uri(
          Uri.parse(
            '${ApiConfig.baseUrl}${ApiPaths.tenantRecordingStream(recording.id)}',
          ),
          headers: {'Authorization': 'Bearer $token'},
        ),
      );
      setState(() => _playingId = recording.id);
      await _player.play();
    } catch (_) {
      if (!mounted) return;
      setState(() => _playingId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not play recording')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final recordingsAsync = ref.watch(recordingsProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppPageHeader(
        title: 'Recordings',
        subtitle: 'Call recordings archive',
        actions: [
          IconButton(
            onPressed: () => ref.read(recordingsProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(recordingsProvider.notifier).refresh(),
        child: recordingsAsync.when(
          loading: () => const LoadingView(),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.5,
                child: ErrorView(
                  error: error,
                  onRetry: () =>
                      ref.read(recordingsProvider.notifier).refresh(),
                ),
              ),
            ],
          ),
          data: (recordings) {
            if (recordings.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.fiber_manual_record_outlined,
                    title: 'No recordings',
                    subtitle:
                        'Call recordings from your organization will appear here.',
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              itemCount: recordings.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final recording = recordings[index];
                final isInbound =
                    recording.direction.toLowerCase() == 'inbound';
                final counterparty =
                    isInbound ? recording.from : recording.to;
                final isActive = _playingId == recording.id;

                return CorporateCard(
                  accent: isActive ? AppColors.royal : AppColors.danger,
                  padding: const EdgeInsets.all(16),
                  onTap: () => _playRecording(recording),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 24,
                        backgroundColor: (isActive
                                ? AppColors.royal
                                : AppColors.danger)
                            .withValues(alpha: 0.12),
                        child: Icon(
                          isActive && _player.playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          color: isActive ? AppColors.royal : AppColors.danger,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              AppFormatters.formatPhone(counterparty),
                              style: AppTypography.mono(context, size: 15),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${AppFormatters.formatDirection(recording.direction)} · ${AppFormatters.formatDateTime(recording.createdAt)}',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      Text(
                        AppFormatters.formatDuration(recording.durationSeconds),
                        style: theme.textTheme.titleSmall,
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
