import { describe, expect, it } from 'vitest';
import {
  collectRecentDialNumbers,
  filterDialSuggestions,
  getCallStatusLabel,
  getConnectionQualityLabel,
  resolveCallPhase,
  resolveAudioRouteFromSpeaker,
} from '../../mobile-rn/src/calling/callDisplay';

describe('mobile / call display (Phase 4.2)', () => {
  it('maps telnyx states to enterprise call phases', () => {
    expect(resolveCallPhase('RINGING', false, false)).toBe('calling');
    expect(resolveCallPhase('RINGING', true, false)).toBe('ringing');
    expect(resolveCallPhase('ACTIVE', false, false)).toBe('connected');
    expect(resolveCallPhase('HELD', false, true)).toBe('held');
  });

  it('labels outbound progression without reloading UI copy', () => {
    expect(getCallStatusLabel('calling')).toBe('Calling…');
    expect(getCallStatusLabel('connecting')).toBe('Connecting…');
    expect(getCallStatusLabel('connected')).toBe('Connected');
    expect(getConnectionQualityLabel('connected')).toBe('HD Voice');
  });

  it('filters dial suggestions by name and extension', () => {
    const contacts = [
      {
        id: '1',
        name: 'Jane Doe',
        extensionNumber: '101',
        assignedDidNumber: '+15551111111',
      },
      {
        id: '2',
        name: 'Support',
        extensionNumber: '200',
        assignedDidNumber: null,
      },
    ];

    expect(filterDialSuggestions(contacts, 'jane')).toHaveLength(1);
    expect(filterDialSuggestions(contacts, '200')).toHaveLength(1);
  });

  it('collects unique recent dial numbers', () => {
    const numbers = collectRecentDialNumbers([
      { from: '+15551111111', to: '+15552222222', direction: 'outbound' },
      { from: '+15553333333', to: '+15552222222', direction: 'inbound' },
      { from: '+15551111111', to: '+15554444444', direction: 'outbound' },
    ]);

    expect(numbers).toEqual(['+15552222222', '+15553333333', '+15554444444']);
  });

  it('resolves speaker route for audio chip', () => {
    expect(resolveAudioRouteFromSpeaker(true)).toBe('speaker');
    expect(resolveAudioRouteFromSpeaker(false)).toBe('phone');
  });
});
