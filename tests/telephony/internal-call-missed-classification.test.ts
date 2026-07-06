import { describe, expect, it, vi } from 'vitest';

/**
 * Bug #3 regression: a failed/unanswered internal desk-to-desk extension call
 * (session.callKind === 'internal') was logged by logInboundCall() as an
 * inbound missed call (direction: 'inbound', callType: 'missed'), which
 * triggered a bogus "missed call" notification for a purely internal routing
 * failure.
 *
 * Fix: logInboundCall() now branches on session.callKind. Internal sessions
 * are logged as an outbound attempt (direction: 'outbound') using the
 * existing outbound taxonomy from lib/callLogMeta.js (callType:
 * 'outbound_no_answer' / 'outbound'), never as an inbound 'missed' call.
 * Real inbound PSTN behaviour (direction: 'inbound', callType: 'missed') is
 * unchanged.
 */

function makePrisma() {
  const upsert = vi.fn().mockResolvedValue(undefined);
  return { callLog: { upsert }, upsert };
}

describe('logInboundCall callKind classification (Bug #3)', () => {
  it('does not log a failed internal extension call as an inbound missed call', async () => {
    const { logInboundCall } = await import('../../lib/inboundCallControl.js');
    const prisma = makePrisma();

    const session = {
      callSessionId: 'sess-internal-1',
      callSid: 'sess-internal-1',
      callKind: 'internal',
      from: 'ext:101',
      to: '102',
      tenantId: 'tenant-a-id',
      stage: 'ringing',
    };

    await logInboundCall(prisma, session, 'no-answer');

    expect(prisma.callLog.upsert).toHaveBeenCalledTimes(1);
    const args = prisma.callLog.upsert.mock.calls[0][0];
    expect(args.create.direction).toBe('outbound');
    expect(args.create.callType).not.toBe('missed');
    expect(args.create.callType).toBe('outbound_no_answer');
    expect(args.update.callType).toBe('outbound_no_answer');
  });

  it('logs a successfully bridged internal extension call as outbound/answered, not inbound', async () => {
    const { logInboundCall } = await import('../../lib/inboundCallControl.js');
    const prisma = makePrisma();

    const session = {
      callSessionId: 'sess-internal-2',
      callKind: 'internal',
      from: 'ext:101',
      to: '102',
      tenantId: 'tenant-a-id',
      stage: 'bridged',
    };

    await logInboundCall(prisma, session, 'completed');

    const args = prisma.callLog.upsert.mock.calls[0][0];
    expect(args.create.direction).toBe('outbound');
    expect(args.create.callType).toBe('outbound');
    expect(args.create.status).toBe('completed');
  });

  it('treats internal_api-originated calls the same as internal (never inbound missed)', async () => {
    const { logInboundCall } = await import('../../lib/inboundCallControl.js');
    const prisma = makePrisma();

    const session = {
      callSessionId: 'sess-internal-3',
      callKind: 'internal_api',
      from: 'ext:100',
      to: '103',
      tenantId: 'tenant-a-id',
      stage: 'ringing',
    };

    await logInboundCall(prisma, session, 'no-answer');

    const args = prisma.callLog.upsert.mock.calls[0][0];
    expect(args.create.direction).toBe('outbound');
    expect(args.create.callType).toBe('outbound_no_answer');
  });

  it('preserves existing inbound missed-call classification for real PSTN sessions', async () => {
    const { logInboundCall } = await import('../../lib/inboundCallControl.js');
    const prisma = makePrisma();

    const session = {
      callSessionId: 'sess-pstn-1',
      from: '+13135551212',
      to: '+18005551212',
      tenantId: 'tenant-a-id',
      stage: 'ringing',
      // no callKind — real inbound PSTN call
    };

    await logInboundCall(prisma, session, 'no-answer');

    const args = prisma.callLog.upsert.mock.calls[0][0];
    expect(args.create.direction).toBe('inbound');
    expect(args.create.callType).toBe('missed');
  });

  it('preserves existing inbound answered classification for real PSTN sessions', async () => {
    const { logInboundCall } = await import('../../lib/inboundCallControl.js');
    const prisma = makePrisma();

    const session = {
      callSessionId: 'sess-pstn-2',
      from: '+13135551212',
      to: '+18005551212',
      tenantId: 'tenant-a-id',
      stage: 'bridged',
    };

    await logInboundCall(prisma, session, 'completed');

    const args = prisma.callLog.upsert.mock.calls[0][0];
    expect(args.create.direction).toBe('inbound');
    expect(args.create.callType).toBe('answered');
  });
});

describe('isInternalCallSession helper', () => {
  it('identifies internal and internal_api call kinds', async () => {
    const { isInternalCallSession } = await import('../../lib/inboundCallControl.js');
    expect(isInternalCallSession({ callKind: 'internal' })).toBe(true);
    expect(isInternalCallSession({ callKind: 'internal_api' })).toBe(true);
    expect(isInternalCallSession({ callKind: undefined })).toBe(false);
    expect(isInternalCallSession({})).toBe(false);
    expect(isInternalCallSession(null)).toBe(false);
  });
});
