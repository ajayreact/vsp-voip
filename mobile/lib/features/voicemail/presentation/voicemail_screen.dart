import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/voicemail/data/models/voicemail_message.dart';
import 'package:vsp_voip_mobile/features/voicemail/providers/voicemail_providers.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/empty_state.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';

class VoicemailScreen extends ConsumerStatefulWidget {
  const VoicemailScreen({super.key});

  @override
  ConsumerState<VoicemailScreen> createState() => _VoicemailScreenState();
}

class _VoicemailScreenState extends ConsumerState<VoicemailScreen> {
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

  Future<void> _playVoicemail(VoicemailMessage voicemail) async {
    if (voicemail.recordingUrl.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Recording URL is not available')),
      );
      return;
    }

    if (_playingId == voicemail.id) {
      if (_player.playing) {
        await _player.pause();
      } else {
        await _player.play();
      }
      setState(() {});
      return;
    }

    try {
      await _player.stop();
      await _player.setUrl(voicemail.recordingUrl);
      setState(() => _playingId = voicemail.id);
      if (!voicemail.isRead) {
        await ref.read(voicemailProvider.notifier).markRead(voicemail.id);
      }
      await _player.play();
    } catch (_) {
      if (!mounted) return;
      setState(() => _playingId = null);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not play voicemail')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final voicemailsAsync = ref.watch(voicemailProvider);
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppPageHeader(
        title: 'Voicemail',
        subtitle: 'Listen to messages left when calls were not answered',
        actions: [
          IconButton(
            onPressed: () => ref.read(voicemailProvider.notifier).refresh(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(voicemailProvider.notifier).refresh(),
        child: voicemailsAsync.when(
          loading: () => const LoadingView(message: 'Loading voicemail…'),
          error: (error, _) => ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              SizedBox(
                height: MediaQuery.sizeOf(context).height * 0.5,
                child: ErrorView(
                  error: error,
                  onRetry: () => ref.read(voicemailProvider.notifier).refresh(),
                ),
              ),
            ],
          ),
          data: (voicemails) {
            if (voicemails.isEmpty) {
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: const [
                  SizedBox(height: 120),
                  EmptyState(
                    icon: Icons.voicemail_rounded,
                    title: 'No voicemail',
                    subtitle:
                        'Messages left when callers reach your voicemail box will appear here.',
                  ),
                ],
              );
            }

            return ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              itemCount: voicemails.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final voicemail = voicemails[index];
                final isPlaying = _playingId == voicemail.id && _player.playing;

                return CorporateCard(
                  accent: voicemail.isRead ? AppColors.slate400 : AppColors.royal,
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      backgroundColor: AppColors.royal.withValues(alpha: 0.12),
                      child: Icon(
                        isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                        color: AppColors.royal,
                      ),
                    ),
                    title: Text(
                      AppFormatters.formatPhone(voicemail.from),
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight:
                            voicemail.isRead ? FontWeight.w500 : FontWeight.w700,
                      ),
                    ),
                    subtitle: Text(
                      [
                        AppFormatters.formatRelativeTime(voicemail.createdAt),
                        if (voicemail.durationSeconds != null)
                          AppFormatters.formatDuration(voicemail.durationSeconds),
                      ].join(' · '),
                      style: theme.textTheme.bodySmall,
                    ),
                    trailing: voicemail.isRead
                        ? null
                        : Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              color: AppColors.royal,
                              shape: BoxShape.circle,
                            ),
                          ),
                    onTap: () => _playVoicemail(voicemail),
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
