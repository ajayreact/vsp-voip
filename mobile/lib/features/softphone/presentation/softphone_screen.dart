import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vsp_voip_mobile/config/api_config.dart';
import 'package:vsp_voip_mobile/config/app_colors.dart';
import 'package:vsp_voip_mobile/config/app_typography.dart';
import 'package:vsp_voip_mobile/core/utils/formatters.dart';
import 'package:vsp_voip_mobile/features/softphone/dial_normalization.dart';
import 'package:vsp_voip_mobile/features/softphone/providers/softphone_controller.dart';
import 'package:vsp_voip_mobile/shared/widgets/app_page_header.dart';
import 'package:vsp_voip_mobile/shared/widgets/corporate_card.dart';
import 'package:vsp_voip_mobile/shared/widgets/empty_state.dart';
import 'package:vsp_voip_mobile/shared/widgets/error_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/loading_view.dart';
import 'package:vsp_voip_mobile/shared/widgets/audio_route_picker.dart';

const _dialKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

class SoftphoneScreen extends ConsumerStatefulWidget {
  const SoftphoneScreen({super.key});

  @override
  ConsumerState<SoftphoneScreen> createState() => _SoftphoneScreenState();
}

class _SoftphoneScreenState extends ConsumerState<SoftphoneScreen> {
  late final TextEditingController _destinationController;
  var _syncingDestination = false;

  @override
  void initState() {
    super.initState();
    _destinationController = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(softphoneControllerProvider.notifier).initialize();
    });
  }

  @override
  void dispose() {
    _destinationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(softphoneControllerProvider, (previous, next) {
      if (previous?.destination != next.destination && !_syncingDestination) {
        _destinationController.value = TextEditingValue(
          text: next.destination,
          selection: TextSelection.collapsed(offset: next.destination.length),
        );
      }
    });

    final state = ref.watch(softphoneControllerProvider);
    final controller = ref.read(softphoneControllerProvider.notifier);
    final theme = Theme.of(context);
    final config = state.config;
    final numbers = config?.numbers ?? [];
    final canDial = state.uiState == SoftphoneUiState.ready &&
        normalizeDialableNumber(state.destination) != null &&
        state.callerId.isNotEmpty;

    return Scaffold(
      appBar: AppPageHeader(
        title: 'Business phone',
        subtitle: state.uiState == SoftphoneUiState.ready
            ? 'Connected · ready for calls'
            : state.status.isNotEmpty
                ? state.status
                : 'Softphone',
        actions: [
          if (state.uiState == SoftphoneUiState.ready)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.success,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'Online',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppColors.success,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (state.uiState == SoftphoneUiState.error ||
              state.uiState == SoftphoneUiState.ready)
            IconButton(
              onPressed: () async {
                if (state.uiState == SoftphoneUiState.ready) {
                  await controller.disconnect();
                }
                await controller.initialize();
              },
              icon: Icon(
                state.uiState == SoftphoneUiState.error
                    ? Icons.refresh_rounded
                    : Icons.sync_rounded,
              ),
              tooltip: state.uiState == SoftphoneUiState.error
                  ? 'Retry'
                  : 'Reconnect',
            ),
        ],
      ),
      body: switch (state.uiState) {
        SoftphoneUiState.idle ||
        SoftphoneUiState.loading ||
        SoftphoneUiState.connecting =>
          LoadingView(message: state.status),
        SoftphoneUiState.notConfigured => ListView(
            padding: const EdgeInsets.all(24),
            children: const [
              EmptyState(
                icon: Icons.settings_phone,
                title: 'Softphone not configured',
                subtitle:
                    'Add a Telnyx Credential Connection ID in Admin → Platform settings, or set TELNYX_CREDENTIAL_CONNECTION_ID in .env.',
              ),
            ],
          ),
        SoftphoneUiState.noNumbers => ListView(
            padding: const EdgeInsets.all(24),
            children: const [
              EmptyState(
                icon: Icons.dialpad,
                title: 'No phone numbers',
                subtitle:
                    'Purchase and assign at least one business number before placing outbound calls.',
              ),
            ],
          ),
        SoftphoneUiState.error => ListView(
            padding: const EdgeInsets.all(24),
            children: [
              ErrorView(
                error: state.error ?? state.status,
                onRetry: controller.retry,
              ),
            ],
          ),
        _ => Column(
            children: [
              if (config != null &&
                  (!config.webhooksReachable ||
                      config.inboundRouting?.ready != true))
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: CorporateCard(
                    accent: AppColors.warning,
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Inbound setup',
                          style: theme.textTheme.titleSmall,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          config.inboundRouting?.message ??
                              config.setupMessage ??
                              'Configure Call Control webhooks and ring group in the web portal.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ),
              if (state.pushRegistered)
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    16,
                    config != null &&
                            (!config.webhooksReachable ||
                                config.inboundRouting?.ready != true)
                        ? 8
                        : 16,
                    16,
                    0,
                  ),
                  child: Text(
                    'Push notifications registered — inbound calls can ring when backgrounded.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                ),
              if (!state.pushRegistered &&
                  config?.inboundRouting?.ready == true)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text(
                    'Push not registered — foreground inbound works; add google-services.json for background ringing.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.tertiary,
                    ),
                  ),
                ),
              if (state.uiState == SoftphoneUiState.incoming)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Text(
                    'Incoming call — use Answer/Decline on the overlay.',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.primary,
                    ),
                  ),
                )
              else ...[
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    children: [
                      if (state.uiState == SoftphoneUiState.calling ||
                          state.uiState == SoftphoneUiState.active ||
                          state.error != null ||
                          state.status.isNotEmpty)
                        CorporateCard(
                          padding: const EdgeInsets.all(16),
                          accent: state.uiState == SoftphoneUiState.active
                              ? AppColors.success
                              : AppColors.royal,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  if (state.uiState == SoftphoneUiState.active)
                                    const Icon(
                                      Icons.call_rounded,
                                      color: AppColors.success,
                                    )
                                  else if (state.uiState ==
                                      SoftphoneUiState.calling)
                                    const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    ),
                                  if (state.uiState == SoftphoneUiState.active ||
                                      state.uiState ==
                                          SoftphoneUiState.calling)
                                    const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      state.uiState == SoftphoneUiState.active
                                          ? 'Call in progress${state.recordingActive ? ' · recording' : ''}'
                                          : state.status,
                                      style: theme.textTheme.titleSmall,
                                    ),
                                  ),
                                  if (state.uiState == SoftphoneUiState.active)
                                    Text(
                                      AppFormatters.formatDuration(
                                        state.elapsedSeconds,
                                      ),
                                      style: AppTypography.mono(
                                        context,
                                        size: 18,
                                        color: AppColors.navy,
                                      ),
                                    ),
                                ],
                              ),
                              if (state.error != null) ...[
                                const SizedBox(height: 8),
                                Text(
                                  state.error!,
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    color: AppColors.danger,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      if (state.uiState == SoftphoneUiState.calling ||
                          state.uiState == SoftphoneUiState.active ||
                          state.error != null ||
                          state.status.isNotEmpty)
                        const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value:
                            state.callerId.isNotEmpty ? state.callerId : null,
                        decoration: const InputDecoration(
                          labelText: 'Caller ID',
                        ),
                        items: numbers
                            .map(
                              (n) => DropdownMenuItem(
                                value: n.number,
                                child: Text(
                                  AppFormatters.formatPhone(n.number),
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: state.inCall
                            ? null
                            : (value) {
                                if (value != null) {
                                  controller.setCallerId(value);
                                }
                              },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        enabled: !state.inCall,
                        controller: _destinationController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Destination (extension or E.164)',
                          hintText: '101 or +15551234567',
                          prefixIcon: Icon(Icons.dialpad),
                        ),
                        onChanged: (value) {
                          _syncingDestination = true;
                          controller.setDestination(value);
                          _syncingDestination = false;
                        },
                      ),
                      const SizedBox(height: 12),
                      GridView.count(
                        crossAxisCount: 3,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 6,
                        crossAxisSpacing: 6,
                        childAspectRatio: 1.35,
                        children: _dialKeys
                            .map(
                              (key) => Material(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                child: InkWell(
                                  onTap: state.inCall
                                      ? null
                                      : () => controller.appendDigit(key),
                                  borderRadius: BorderRadius.circular(16),
                                  child: Container(
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: AppColors.slate200,
                                      ),
                                    ),
                                    alignment: Alignment.center,
                                    child: Text(
                                      key,
                                      style: theme.textTheme.headlineSmall
                                          ?.copyWith(
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.navy,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                      if (config?.callRecordingEnabled == true) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Outbound calls are recorded when Call routing → Call recording is enabled.',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (state.inCall) ...[
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: controller.toggleMute,
                                  icon: Icon(
                                    state.muted ? Icons.mic_off : Icons.mic,
                                  ),
                                  label: Text(
                                    state.muted ? 'Unmute' : 'Mute',
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () async {
                                    final notifier = ref.read(
                                      softphoneControllerProvider.notifier,
                                    );
                                    final call = notifier.activeCall;
                                    if (call == null) return;
                                    final kind = await showAudioRoutePicker(
                                      context: context,
                                      call: call,
                                      selected: notifier.activeAudioRoute,
                                    );
                                    if (kind != null) {
                                      await notifier.applyAudioRouteKind(kind);
                                    }
                                  },
                                  icon: const Icon(Icons.settings_input_hdmi_rounded),
                                  label: const Text('Audio'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                        ],
                        Row(
                          children: [
                            Expanded(
                              child: !state.inCall
                                  ? FilledButton.icon(
                                      onPressed:
                                          canDial ? controller.placeCall : null,
                                      icon: const Icon(Icons.call),
                                      label: const Text('Call'),
                                    )
                                  : FilledButton.icon(
                                      onPressed: controller.hangUp,
                                      style: FilledButton.styleFrom(
                                        backgroundColor: AppColors.danger,
                                      ),
                                      icon: const Icon(Icons.call_end_rounded),
                                      label: const Text('Hang up'),
                                    ),
                            ),
                            if (!state.inCall &&
                                state.destination.isNotEmpty) ...[
                              const SizedBox(width: 8),
                              IconButton.outlined(
                                onPressed: controller.backspace,
                                icon: const Icon(Icons.backspace_outlined),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'API · ${ApiConfig.baseUrl}',
                          style: theme.textTheme.bodySmall,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
      },
    );
  }
}
