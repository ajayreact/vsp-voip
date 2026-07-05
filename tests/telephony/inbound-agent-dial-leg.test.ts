import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

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

  it('handleInboundCallControlEvent wires guard before desk outbound handler', () => {
    const source = readFileSync(join(process.cwd(), 'lib/inboundCallControl.js'), 'utf8');
    expect(source).toContain('handleInboundAgentDialLegInitiated');
    expect(source).toMatch(
      /case 'call\.initiated':[\s\S]*handleInboundAgentDialLegInitiated\(payload\)[\s\S]*handleParkedWebRtcOutboundInitiated/,
    );
  });
});
