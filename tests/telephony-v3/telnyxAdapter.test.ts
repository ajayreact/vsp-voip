import { describe, expect, it, vi } from 'vitest';

const telnyxAdapter = require('../../lib/telephony-v3/Executor/telnyxAdapter');

function mockTelnyx(overrides = {}) {
  return {
    answerCall: vi.fn().mockResolvedValue({ id: 'req-answer' }),
    hangupCall: vi.fn().mockResolvedValue({ id: 'req-hangup' }),
    bridgeCalls: vi.fn().mockResolvedValue({ id: 'req-bridge' }),
    speakCall: vi.fn().mockResolvedValue({ id: 'req-speak' }),
    startCallRecording: vi.fn().mockResolvedValue({ id: 'req-record' }),
    callControlAction: vi.fn().mockResolvedValue({ id: 'req-action' }),
    holdCall: vi.fn().mockResolvedValue({ id: 'req-hold' }),
    unholdCall: vi.fn().mockResolvedValue({ id: 'req-unhold' }),
    transferCall: vi.fn().mockResolvedValue({ id: 'req-transfer' }),
    joinConference: vi.fn().mockResolvedValue({ id: 'req-conf-join' }),
    leaveConference: vi.fn().mockResolvedValue({ id: 'req-conf-leave' }),
    muteCall: vi.fn().mockResolvedValue({ id: 'req-mute' }),
    unmuteCall: vi.fn().mockResolvedValue({ id: 'req-unmute' }),
    dialDestination: vi.fn().mockResolvedValue({ id: 'req-dial' }),
    startVoicemailRecording: vi.fn().mockResolvedValue({ id: 'req-vm' }),
    gatherUsingSpeak: vi.fn().mockResolvedValue({ id: 'req-gather' }),
    ...overrides,
  };
}

describe('V3 telnyxAdapter', () => {
  it('returns skipped for unsupported command types', async () => {
    const result = await telnyxAdapter.executeCommand({
      commandType: 'FORWARD',
      callControlId: 'cc-1',
      payload: {},
      telnyx: mockTelnyx(),
    });

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('unsupported');
  });

  it('executes HANGUP via hangupCall', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'HANGUP',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    });

    expect(telnyx.hangupCall).toHaveBeenCalledWith('cc-1');
    expect(result.ok).toBe(true);
    expect(result.telnyxRequestId).toBe('req-hangup');
  });

  it('executes BRIDGE with otherCallControlId', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'BRIDGE',
      callControlId: 'cc-a',
      payload: { otherCallControlId: 'cc-b' },
      commandId: 'cmd-1',
      telnyx,
    });

    expect(telnyx.bridgeCalls).toHaveBeenCalledWith('cc-a', expect.objectContaining({
      otherCallControlId: 'cc-b',
      commandId: 'cmd-1',
    }));
  });

  it('maps PLAY_AUDIO to playback_start when audioUrl provided', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'PLAY_AUDIO',
      callControlId: 'cc-1',
      payload: { audioUrl: 'https://example.com/prompt.mp3' },
      telnyx,
    });

    expect(telnyx.callControlAction).toHaveBeenCalledWith(
      'cc-1',
      'playback_start',
      expect.objectContaining({ audio_url: 'https://example.com/prompt.mp3' }),
    );
  });

  it('maps STOP_AUDIO to playback_stop', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'STOP_AUDIO',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    });

    expect(telnyx.callControlAction).toHaveBeenCalledWith('cc-1', 'playback_stop', {});
  });

  it('maps START_RECORDING to startCallRecording', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'START_RECORDING',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    });

    expect(telnyx.startCallRecording).toHaveBeenCalledWith('cc-1', undefined);
  });

  it('executes HOLD via holdCall', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'HOLD',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    });

    expect(telnyx.holdCall).toHaveBeenCalledWith('cc-1', undefined);
    expect(result.ok).toBe(true);
    expect(result.telnyxRequestId).toBe('req-hold');
  });

  it('executes UNHOLD via unholdCall', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'UNHOLD',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    });

    expect(telnyx.unholdCall).toHaveBeenCalledWith('cc-1', undefined);
    expect(result.ok).toBe(true);
    expect(result.telnyxRequestId).toBe('req-unhold');
  });

  it('executes TRANSFER via transferCall', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'TRANSFER',
      callControlId: 'cc-1',
      payload: { to: '+15551234567' },
      commandId: 'cmd-x',
      telnyx,
    });

    expect(telnyx.transferCall).toHaveBeenCalledWith('cc-1', expect.objectContaining({
      to: '+15551234567',
    }));
    expect(result.ok).toBe(true);
    expect(result.telnyxRequestId).toBe('req-transfer');
  });

  it('executes START_VOICEMAIL via startVoicemailRecording', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'START_VOICEMAIL',
      callControlId: 'cc-1',
      payload: { maxLength: 90 },
      telnyx,
    });

    expect(telnyx.startVoicemailRecording).toHaveBeenCalledWith('cc-1', expect.objectContaining({ maxLength: 90 }));
    expect(result.ok).toBe(true);
    expect(result.telnyxRequestId).toBe('req-vm');
  });

  it('executes STOP_VOICEMAIL via record_stop', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'STOP_VOICEMAIL',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    });

    expect(telnyx.callControlAction).toHaveBeenCalledWith('cc-1', 'record_stop', {});
    expect(result.ok).toBe(true);
  });

  it('executes PLAY_GREETING via playback_start', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'PLAY_GREETING',
      callControlId: 'cc-1',
      payload: { audioUrl: 'https://example.com/greeting.mp3' },
      telnyx,
    });

    expect(telnyx.callControlAction).toHaveBeenCalledWith(
      'cc-1',
      'playback_start',
      expect.objectContaining({ audio_url: 'https://example.com/greeting.mp3' }),
    );
  });

  it('executes STOP_RECORDING via record_stop', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'STOP_RECORDING',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    });

    expect(telnyx.callControlAction).toHaveBeenCalledWith('cc-1', 'record_stop', {});
    expect(result.ok).toBe(true);
  });

  it('executes CREATE_CONFERENCE via joinConference', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'CREATE_CONFERENCE',
      callControlId: 'cc-host',
      payload: { conferenceId: 'conf-1', conferenceName: 'conf-1' },
      telnyx,
    });

    expect(telnyx.joinConference).toHaveBeenCalledWith('cc-host', expect.objectContaining({
      conferenceName: 'conf-1',
      startConferenceOnEnter: true,
    }));
    expect(result.ok).toBe(true);
  });

  it('executes MUTE_PARTICIPANT via muteCall', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'MUTE_PARTICIPANT',
      callControlId: 'cc-p2',
      payload: {},
      telnyx,
    });
    expect(telnyx.muteCall).toHaveBeenCalledWith('cc-p2', undefined);
  });

  it('executes REMOVE_PARTICIPANT with force via hangupCall', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'REMOVE_PARTICIPANT',
      callControlId: 'cc-p2',
      payload: { force: true },
      telnyx,
    });
    expect(telnyx.hangupCall).toHaveBeenCalledWith('cc-p2');
  });

  it('executes ENQUEUE via holdCall', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'ENQUEUE',
      callControlId: 'cc-caller',
      payload: {},
      telnyx,
    });
    expect(telnyx.holdCall).toHaveBeenCalledWith('cc-caller', undefined);
    expect(result.ok).toBe(true);
  });

  it('executes DEQUEUE via unholdCall', async () => {
    const telnyx = mockTelnyx();
    await telnyxAdapter.executeCommand({
      commandType: 'DEQUEUE',
      callControlId: 'cc-caller',
      payload: {},
      telnyx,
    });
    expect(telnyx.unholdCall).toHaveBeenCalledWith('cc-caller', undefined);
  });

  it('executes DIAL via dialDestination', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'DIAL',
      callControlId: 'cc-caller',
      payload: { to: 'sip:agent@sip.telnyx.com', connectionId: 'conn-1' },
      telnyx,
    });
    expect(telnyx.dialDestination).toHaveBeenCalledWith('cc-caller', expect.objectContaining({
      to: 'sip:agent@sip.telnyx.com',
    }));
    expect(result.ok).toBe(true);
  });

  it('executes GATHER via gatherUsingSpeak', async () => {
    const telnyx = mockTelnyx();
    const result = await telnyxAdapter.executeCommand({
      commandType: 'GATHER',
      callControlId: 'cc-caller',
      payload: { prompt: 'Press 1', timeoutSec: 7, maxDigits: 2 },
      telnyx,
    });
    expect(telnyx.gatherUsingSpeak).toHaveBeenCalledWith('cc-caller', expect.objectContaining({
      prompt: 'Press 1',
      maximumDigits: 2,
      timeoutMillis: 7000,
    }));
    expect(result.ok).toBe(true);
  });

  it('throws validation error when callControlId missing', async () => {
    await expect(telnyxAdapter.executeCommand({
      commandType: 'HANGUP',
      payload: {},
      telnyx: mockTelnyx(),
    })).rejects.toMatchObject({ status: 400 });
  });

  it('normalizes adapter failures', async () => {
    const telnyx = mockTelnyx({
      hangupCall: vi.fn().mockRejectedValue(Object.assign(new Error('upstream failed'), { status: 502 })),
    });

    await expect(telnyxAdapter.executeCommand({
      commandType: 'HANGUP',
      callControlId: 'cc-1',
      payload: {},
      telnyx,
    })).rejects.toMatchObject({ message: 'upstream failed', status: 502 });
  });
});
