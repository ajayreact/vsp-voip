import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// inboundCallControl.js is plain CommonJS; load it via Node's native require
// so this test exercises the exact same module instance production code uses.
const nodeRequire = createRequire(import.meta.url);
const inboundCallControl: any = nodeRequire('../../lib/inboundCallControl.js');

const { sanitizeDisplayName, resolveAgentRingDisplayName, resolveAgentRingFrom } = inboundCallControl;

/**
 * Regression coverage for the Desk->Desk / Extension->Extension voicemail bug.
 *
 * Root cause (confirmed via live runtime trace on the test environment):
 * internal call sessions set `session.from` to a caller label like "ext:100"
 * (see ExtensionCallService.handleExtensionOutbound / beginInternalExtensionRing).
 * resolveAgentRingDisplayName() forwarded that value verbatim as the Telnyx
 * `from_display_name` field. Telnyx's Call Control API only allows letters,
 * numbers, spaces, and -_~!.+ in that field (see
 * docs/telnyx/call-control/api-reference/call-commands/dial.md). The colon
 * in "ext:100" caused Telnyx to reject the entire POST /calls request with
 * HTTP 422 (error code 10000), so dialDestination() threw before the
 * destination was ever dialed, and the call fell straight through to
 * voicemail.
 *
 * Fix: sanitizeDisplayName() strips any character outside Telnyx's allowed
 * set before it is used as fromDisplayName. resolveAgentRingFrom() (the
 * actual SIP From address/number) and dialDestination() are untouched.
 */
describe('telephony / agent ring display name sanitization', () => {
  it('sanitizes "ext:100" into a Telnyx-valid display name by stripping the colon', () => {
    expect(sanitizeDisplayName('ext:100')).toBe('ext100');
  });

  it('resolveAgentRingDisplayName() sanitizes session.from for internal extension calls', () => {
    const session = {
      callKind: 'internal',
      from: 'ext:100',
    };
    const result = resolveAgentRingDisplayName(session);
    expect(result).toBe('ext100');
    // Must never contain a colon or any other Telnyx-disallowed character.
    expect(result).toMatch(/^[A-Za-z0-9 \-_~!.+]*$/);
  });

  it('removes all characters outside the Telnyx-documented allowed set (letters, numbers, spaces, -_~!.+)', () => {
    expect(sanitizeDisplayName('Front Desk (Sales)#1')).toBe('Front Desk Sales1');
    expect(sanitizeDisplayName('user@example.com')).toBe('userexample.com');
    expect(sanitizeDisplayName('ext:100/mobile')).toBe('ext100mobile');
  });

  it('preserves Telnyx-allowed special characters unchanged', () => {
    expect(sanitizeDisplayName('Sales - Team_1 ~Home!.+')).toBe('Sales - Team_1 ~Home!.+');
  });

  it('falls back to undefined when sanitization removes everything', () => {
    expect(sanitizeDisplayName(':::###')).toBeUndefined();
    expect(sanitizeDisplayName('')).toBeUndefined();
    expect(sanitizeDisplayName(null)).toBeUndefined();
    expect(sanitizeDisplayName(undefined)).toBeUndefined();
  });

  it('resolveAgentRingDisplayName() returns undefined (Telnyx default) when the sanitized result is empty', () => {
    const session = { callKind: 'internal', from: ':::' };
    expect(resolveAgentRingDisplayName(session)).toBeUndefined();
  });

  it('leaves PSTN E.164 display names unchanged (no regression for inbound PSTN dial)', () => {
    expect(sanitizeDisplayName('+19563961388')).toBe('+19563961388');

    const pstnSession = { callKind: 'pstn', from: '+19563961388' };
    expect(resolveAgentRingDisplayName(pstnSession)).toBe('+19563961388');
  });

  it('leaves a real CNAM-style display name unchanged', () => {
    const session = {
      callKind: 'pstn',
      callerDisplayName: 'John Smith',
      from: '+19563961388',
    };
    expect(resolveAgentRingDisplayName(session)).toBe('John Smith');
  });

  it('truncates to 128 characters, matching Telnyx max length', () => {
    const long = 'A'.repeat(200);
    const result = sanitizeDisplayName(long);
    expect(result).toHaveLength(128);
  });

  describe('resolveAgentRingFrom() for internal extension rings', () => {
    it('uses agentRingFrom E.164 instead of ext: shorthand', () => {
      expect(resolveAgentRingFrom({
        callKind: 'internal',
        from: 'ext:100',
        agentRingFrom: '+13139215654',
        to: 'ext:101',
      })).toBe('+13139215654');
    });

    it('does not pass ext: labels to Telnyx when agentRingFrom is missing', () => {
      expect(resolveAgentRingFrom({
        callKind: 'internal',
        from: 'ext:100',
        to: '+19563961388',
      })).toBe('+19563961388');
    });
  });
});
