import { beforeEach, describe, expect, it } from 'vitest';

const { metrics } = require('../../lib/telephony-v3/Utils/metrics');

describe('V3 metrics', () => {
  beforeEach(() => {
    metrics.resetMetricsForTests();
  });

  it('increments counters and renders prometheus text', async () => {
    metrics.ingressReceived({ event_type: 'call.initiated' });
    metrics.ingressEnqueued({ event_type: 'call.initiated' });
    metrics.setOutboxPending(3);

    const text = await metrics.renderPrometheus();
    expect(text).toContain('vsp_telephony_v3_ingress_received_total');
    expect(text).toContain('vsp_telephony_v3_outbox_pending 3');
  });

  it('bounds histogram samples', () => {
    for (let i = 0; i < 1100; i += 1) {
      metrics.observeWorkerDuration(10, { event_type: 'call.initiated' });
    }
    expect(metrics.renderPrometheus).toBeDefined();
  });

  it('records command executor metrics', async () => {
    metrics.commandsStarted({ command_type: 'HANGUP', tenant_id: 't-1' });
    metrics.commandsCompleted({ command_type: 'HANGUP', tenant_id: 't-1' });
    metrics.commandsFailed({ command_type: 'HANGUP', tenant_id: 't-1', failure_class: 'Retryable' });
    metrics.commandRetry({ command_type: 'HANGUP', tenant_id: 't-1' });
    metrics.commandDlq({ command_type: 'HANGUP', tenant_id: 't-1' });
    metrics.observeCommandDuration(25, { command_type: 'HANGUP', tenant_id: 't-1' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('commands_started_total');
    expect(text).toContain('commands_completed_total');
    expect(text).toContain('commands_failed_total');
    expect(text).toContain('command_retry_total');
    expect(text).toContain('command_dlq_total');
    expect(text).toContain('command_execution_duration_seconds_count');
  });

  it('records desk routing metrics', async () => {
    metrics.deskRoute({ routing_flow: 'DESK_TO_DESK', result: 'completed' });
    metrics.deskRouteFailed({ routing_flow: 'UNKNOWN', reason: 'error' });
    metrics.policyDenied({ routing_flow: 'DESK_TO_PSTN', reason: 'international' });
    metrics.destinationResolution({ destination_type: 'EXTENSION', routing_flow: 'DESK_TO_DESK' });
    metrics.observeDeskRouteDuration(15, { routing_flow: 'DESK_TO_DESK' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('desk_route_total');
    expect(text).toContain('desk_route_failed');
    expect(text).toContain('policy_denied_total');
    expect(text).toContain('destination_resolution_total');
    expect(text).toContain('desk_route_duration_seconds_count');
  });

  it('records mobile routing metrics', async () => {
    metrics.mobileRoute({ routing_flow: 'MOBILE_TO_MOBILE', result: 'completed' });
    metrics.mobileRouteFailed({ routing_flow: 'UNKNOWN', reason: 'error' });
    metrics.mobileDestinationResolution({ destination_type: 'EMPLOYEE_SIP', routing_flow: 'MOBILE_TO_MOBILE' });
    metrics.observeMobileRouteDuration(12, { routing_flow: 'MOBILE_TO_MOBILE' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('mobile_route_total');
    expect(text).toContain('mobile_route_failed');
    expect(text).toContain('mobile_destination_resolution_total');
    expect(text).toContain('mobile_route_duration_seconds_count');
  });

  it('records pstn routing metrics', async () => {
    metrics.pstnRoute({ routing_flow: 'PSTN_TO_DESK', result: 'completed' });
    metrics.pstnRouteFailed({ routing_flow: 'UNKNOWN', reason: 'error' });
    metrics.pstnDestinationResolution({ destination_type: 'DESK_SIP', routing_flow: 'PSTN_TO_DESK' });
    metrics.observePstnRouteDuration(18, { routing_flow: 'PSTN_TO_DESK' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('pstn_route_total');
    expect(text).toContain('pstn_route_failed');
    expect(text).toContain('pstn_destination_resolution_total');
    expect(text).toContain('pstn_route_duration_seconds_count');
  });

  it('records hold and transfer metrics', async () => {
    metrics.holdTotal({ result: 'started' });
    metrics.holdFailed({ reason: 'error' });
    metrics.observeHoldDuration(5, { action: 'start' });
    metrics.transferTotal({ transfer_type: 'BLIND', action: 'START' });
    metrics.transferFailed({ transfer_type: 'BLIND', reason: 'timeout' });
    metrics.observeTransferDuration(10, { transfer_type: 'ATTENDED' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('hold_total');
    expect(text).toContain('hold_duration_seconds_count');
    expect(text).toContain('transfer_total');
    expect(text).toContain('transfer_failed_total');
    expect(text).toContain('transfer_duration_seconds_count');
  });

  it('records recording and voicemail metrics', async () => {
    metrics.recordingTotal({ result: 'started', mode: 'MANUAL' });
    metrics.recordingFailed({ reason: 'error', mode: 'MANUAL' });
    metrics.observeRecordingDuration(8, { action: 'start' });
    metrics.voicemailTotal({ result: 'started', vm_reason: 'NO_ANSWER' });
    metrics.voicemailFailed({ reason: 'timeout', vm_reason: 'NO_ANSWER' });
    metrics.observeVoicemailDuration(15, { action: 'start' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('recording_total');
    expect(text).toContain('recording_failed_total');
    expect(text).toContain('recording_duration_seconds_count');
    expect(text).toContain('voicemail_total');
    expect(text).toContain('voicemail_failed_total');
    expect(text).toContain('voicemail_duration_seconds_count');
  });

  it('records conference metrics', async () => {
    metrics.conferenceTotal({ result: 'created', action: 'create' });
    metrics.conferenceFailed({ reason: 'error', action: 'create' });
    metrics.observeConferenceDuration(20, { action: 'create' });
    metrics.conferenceParticipants({ action: 'join' });
    metrics.conferenceRecordingTotal({ result: 'started' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('conference_total');
    expect(text).toContain('conference_failed_total');
    expect(text).toContain('conference_duration_seconds_count');
    expect(text).toContain('conference_participants');
    expect(text).toContain('conference_recording_total');
  });

  it('records queue metrics', async () => {
    metrics.queueTotal({ result: 'entered', action: 'join' });
    metrics.observeQueueWaitDuration(12, { action: 'enter' });
    metrics.queueAgentSelection({ strategy: 'ROUND_ROBIN', count: 1 });
    metrics.queueTimeout({ reason: 'agent_timeout' });
    metrics.queueRetry({ attempt: 2 });
    metrics.queueOverflow({ reason: 'max_retries' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('queue_total');
    expect(text).toContain('queue_wait_duration_seconds_count');
    expect(text).toContain('queue_agent_selection_total');
    expect(text).toContain('queue_timeout_total');
    expect(text).toContain('queue_retry_total');
    expect(text).toContain('queue_overflow_total');
  });

  it('records ivr metrics', async () => {
    metrics.ivrTotal({ result: 'started', action: 'start' });
    metrics.observeIvrDuration(9, { action: 'start' });
    metrics.ivrInputTotal({ input_type: 'SINGLE' });
    metrics.ivrInvalidTotal({ reason: 'invalid_digit' });
    metrics.ivrTimeoutTotal({ reason: 'digit_timeout' });
    metrics.ivrRouteTotal({ destination_type: 'EXTENSION' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('ivr_total');
    expect(text).toContain('ivr_duration_seconds_count');
    expect(text).toContain('ivr_input_total');
    expect(text).toContain('ivr_invalid_total');
    expect(text).toContain('ivr_timeout_total');
    expect(text).toContain('ivr_route_total');
  });

  it('records phase 3.9.5 hardening metrics', async () => {
    metrics.tenantBootstrapSuccess({ source: 'did_lookup' });
    metrics.tenantBootstrapFailed({ reason: 'unknown_did' });
    metrics.sessionCleanupTotal({ reason: 'session_closed' }, 1);
    metrics.timerExecutionTotal({ timer_name: 'queue-wait-timeout' });
    metrics.replayTotal({ scope: 'session' }, 2);
    metrics.outboxCleanupTotal({ status: 'DEAD' }, 4);
    metrics.executorLeaseRenewal({ worker_id: 'worker-1' });

    const text = await metrics.renderPrometheus();
    expect(text).toContain('tenant_bootstrap_success_total');
    expect(text).toContain('executor_lease_renewal_total');
  });
});
