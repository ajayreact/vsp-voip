import { describe, expect, it } from 'vitest';
import {
  inboundHangupIndicatesCallerAbandoned,
  isDialProgressionStatus,
  isLegCancelApiInitiated,
  markLegCancelRequested,
  shouldDeferOutboundHangupAdvance,
} from '../../lib/telephony/callerAbandonLifecycle.js';

describe('callerAbandonLifecycle helpers', () => {
  it('detects PSTN caller abandon from inbound hangup payload', () => {
    expect(inboundHangupIndicatesCallerAbandoned({ hangup_cause: 'originator_cancel' })).toBe(true);
    expect(inboundHangupIndicatesCallerAbandoned({ hangup_source: 'caller' })).toBe(true);
    expect(inboundHangupIndicatesCallerAbandoned({ hangup_cause: 'normal_clearing', hangup_source: 'callee' })).toBe(false);
  });

  it('distinguishes dial progression vs cancel statuses', () => {
    expect(isDialProgressionStatus('no-answer')).toBe(true);
    expect(isDialProgressionStatus('busy')).toBe(true);
    expect(isDialProgressionStatus('hangup')).toBe(false);
    expect(isDialProgressionStatus('')).toBe(false);
  });

  it('marks API-initiated leg cancel for hangup origin diagnostics', () => {
    const session: Record<string, unknown> = {};
    markLegCancelRequested(session, 'v3:desk-leg');
    expect(isLegCancelApiInitiated(session, 'v3:desk-leg')).toBe(true);
    expect(isLegCancelApiInitiated(session, 'v3:other')).toBe(false);
  });

  it('defers outbound hangup advance only for ring-first parked PSTN', () => {
    expect(shouldDeferOutboundHangupAdvance({ deferPstnAnswerUntilAgent: true, pstnAnswered: false })).toBe(true);
    expect(shouldDeferOutboundHangupAdvance({ deferPstnAnswerUntilAgent: true, pstnAnswered: true })).toBe(false);
    expect(shouldDeferOutboundHangupAdvance({ deferPstnAnswerUntilAgent: false })).toBe(false);
  });
});
