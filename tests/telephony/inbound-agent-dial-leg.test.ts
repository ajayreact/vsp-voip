import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('telephony / inbound agent dial leg guard', () => {
  afterEach(async () => {
    const { __resetMemoryClaimStateForTests } = await import('../../lib/callControlSession.js');
    __resetMemoryClaimStateForTests();
  });

  it('indexes outbound leg when link_to references an existing inbound session', async () => {
    const { saveSession, resolveInboundIdFromLeg } = await import('../../lib/callControlSession.js');
    const { handleInboundAgentDialLegInitiated } = await import('../../lib/inboundCallControl.js');

    await saveSession('inbound-cc-1', {
      callControlId: 'inbound-cc-1',
      stage: 'ringing',
      tenantId: 'tenant-1',
    });

    const handled = await handleInboundAgentDialLegInitiated({
      call_control_id: 'outbound-leg-1',
      direction: 'outgoing',
      link_to: 'inbound-cc-1',
      from: '+19724301252',
      to: 'sip:desk-ext100@sip.telnyx.com',
    });

    expect(handled).toBe(true);
    expect(await resolveInboundIdFromLeg('outbound-leg-1')).toBe('inbound-cc-1');
  });

  it('indexes outbound leg when resolveInboundIdFromLeg already maps the leg', async () => {
    const {
      saveSession,
      indexOutboundLeg,
      resolveInboundIdFromLeg,
    } = await import('../../lib/callControlSession.js');
    const { handleInboundAgentDialLegInitiated } = await import('../../lib/inboundCallControl.js');

    await saveSession('inbound-cc-2', {
      callControlId: 'inbound-cc-2',
      stage: 'ringing',
      tenantId: 'tenant-2',
    });
    await indexOutboundLeg('inbound-cc-2', 'outbound-leg-2');

    const handled = await handleInboundAgentDialLegInitiated({
      call_control_id: 'outbound-leg-2',
      direction: 'outbound',
      from: '+19724301252',
      to: 'sip:desk-ext100@sip.telnyx.com',
    });

    expect(handled).toBe(true);
    expect(await resolveInboundIdFromLeg('outbound-leg-2')).toBe('inbound-cc-2');
  });

  it('indexes outbound leg when pending agent ring matches sip:gencred URI destination', async () => {
    const CREDENTIAL_USER = 'gencredpzmztestuser01abc123xyz'.toLowerCase();
    const {
      saveSession,
      indexPendingAgentRing,
      resolveInboundIdFromLeg,
    } = await import('../../lib/callControlSession.js');
    const { handleInboundAgentDialLegInitiated } = await import('../../lib/inboundCallControl.js');

    await saveSession('inbound-cc-3', {
      callControlId: 'inbound-cc-3',
      stage: 'ringing',
      tenantId: 'tenant-3',
      from: '+19724301252',
    });
    await indexPendingAgentRing('inbound-cc-3', CREDENTIAL_USER, '+19724301252');

    const handled = await handleInboundAgentDialLegInitiated({
      call_control_id: 'outbound-leg-3',
      direction: 'outgoing',
      from: '+19724301252',
      to: `sip:${CREDENTIAL_USER}@sip.telnyx.com`,
    });

    expect(handled).toBe(true);
    expect(await resolveInboundIdFromLeg('outbound-leg-3')).toBe('inbound-cc-3');
  });

  it('returns false for real desk outbound legs without inbound parent session', async () => {
    const { handleInboundAgentDialLegInitiated } = await import('../../lib/inboundCallControl.js');

    const handled = await handleInboundAgentDialLegInitiated({
      call_control_id: 'parked-outbound-1',
      direction: 'outgoing',
      state: 'parked',
      from: 'sip:desk@sip.telnyx.com',
      to: '+13135551212',
    });

    expect(handled).toBe(false);
  });

  it('returns false when link_to does not reference a saved inbound session', async () => {
    const { handleInboundAgentDialLegInitiated } = await import('../../lib/inboundCallControl.js');

    const handled = await handleInboundAgentDialLegInitiated({
      call_control_id: 'outbound-leg-3',
      direction: 'outgoing',
      link_to: 'missing-inbound-session',
      from: '+19724301252',
      to: 'sip:desk@sip.telnyx.com',
    });

    expect(handled).toBe(false);
  });

  it('logs guard diagnostics when credential SIP URI has no parent session', async () => {
    const { handleInboundAgentDialLegInitiated } = await import('../../lib/inboundCallControl.js');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const handled = await handleInboundAgentDialLegInitiated({
      call_control_id: 'outbound-leg-diag',
      direction: 'outgoing',
      from: '+19724301252',
      to: 'sip:gencredpzmzorphan01abc123xyz@sip.telnyx.com',
    });

    expect(handled).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(
      '[CALL CONTROL] inbound agent dial leg guard: no parent session (falling through to desk outbound handler)',
      expect.objectContaining({
        to: 'sip:gencredpzmzorphan01abc123xyz@sip.telnyx.com',
        credentialUser: 'gencredpzmzorphan01abc123xyz',
        resolveInboundIdFromLeg: null,
      }),
    );
    logSpy.mockRestore();
  });

  it('handleInboundCallControlEvent wires guard before desk outbound handler', () => {
    const source = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');
    expect(source).toContain('handleInboundAgentDialLegInitiated');
    expect(source).toMatch(
      /case 'call\.initiated':[\s\S]*handleInboundAgentDialLegInitiated\(payload\)[\s\S]*handleParkedWebRtcOutboundInitiated/,
    );
  });
});

describe('telephony / inbound agent credential ring guard (voice webhook)', () => {
  const CREDENTIAL_USER = 'gencrededqqicfmgxkrbg09cwmesz6kpur5ukcrglzygHy1lr'.toLowerCase();

  afterEach(async () => {
    const { __resetMemoryClaimStateForTests } = await import('../../lib/callControlSession.js');
    __resetMemoryClaimStateForTests();
  });

  it('indexes credential incoming leg when pending agent ring exists', async () => {
    const {
      saveSession,
      indexPendingAgentRing,
      resolveInboundIdFromLeg,
    } = await import('../../lib/callControlSession.js');
    const { handleInboundAgentCredentialRingInitiated } = await import('../../lib/inboundCallControl.js');

    await saveSession('inbound-cc-voice-1', {
      callControlId: 'inbound-cc-voice-1',
      stage: 'ringing',
      tenantId: 'tenant-1',
      from: '+19724301252',
    });
    await indexPendingAgentRing('inbound-cc-voice-1', CREDENTIAL_USER, '+19724301252');

    const handled = await handleInboundAgentCredentialRingInitiated({
      call_control_id: 'credential-incoming-leg-1',
      direction: 'incoming',
      to: 'gencredeDqQICfmgxKrBg09CwMeSz6KPur5ukCrGlzYgHy1LR',
      from: '+19724301252',
    });

    expect(handled).toBe(true);
    expect(await resolveInboundIdFromLeg('credential-incoming-leg-1')).toBe('inbound-cc-voice-1');
  });

  it('returns false for incoming PSTN DID (real inbound call)', async () => {
    const { handleInboundAgentCredentialRingInitiated } = await import('../../lib/inboundCallControl.js');

    const handled = await handleInboundAgentCredentialRingInitiated({
      call_control_id: 'inbound-pstn-leg',
      direction: 'incoming',
      to: '+13139215654',
      from: '+19724301252',
    });

    expect(handled).toBe(false);
  });

  it('returns false for credential incoming without parent inbound session', async () => {
    const { handleInboundAgentCredentialRingInitiated } = await import('../../lib/inboundCallControl.js');

    const handled = await handleInboundAgentCredentialRingInitiated({
      call_control_id: 'credential-orphan-leg',
      direction: 'incoming',
      to: 'gencredeDqQICfmgxKrBg09CwMeSz6KPur5ukCrGlzYgHy1LR',
      from: '+19724301252',
    });

    expect(handled).toBe(false);
  });

  it('handleInboundCallControlEvent wires credential guard before handleCallInitiated', () => {
    const source = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');
    expect(source).toContain('handleInboundAgentCredentialRingInitiated');
    expect(source).toMatch(
      /direction[^\n]*incoming[\s\S]*handleInboundAgentCredentialRingInitiated\(payload\)[\s\S]*handleCallInitiated/,
    );
  });
});
