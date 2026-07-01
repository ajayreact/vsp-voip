import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/telnyxWebhookDedup', () => ({
  claimTelnyxWebhookEvent: vi.fn(async () => {}),
  extractTelnyxEventId: (body: { data?: { id?: string } }) => body?.data?.id ?? null,
}));

const prisma = require('../../lib/telephony-v3/internal/prisma');
const streams = require('../../lib/telephony-v3/Redis/streams');
const gateway = require('../../lib/telephony-v3/WebhookGateway/gateway');

describe('V3 WebhookGateway', () => {
  const mockFindUnique = vi.fn();
  const mockCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEPHONY_V3_INGRESS_ENABLED = 'true';
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({});
    prisma.__setGetPrismaForTests(async () => ({
      processedTelnyxEvent: {
        findUnique: mockFindUnique,
        create: mockCreate,
      },
    }));
    vi.spyOn(streams, 'storeIngressPayload').mockResolvedValue(undefined);
    vi.spyOn(streams, 'enqueueIngressJob').mockResolvedValue('1700000000000-0');
  });

  afterEach(() => {
    prisma.__resetGetPrismaForTests();
  });

  it('returns disabled when ingress flag off', async () => {
    process.env.TELEPHONY_V3_INGRESS_ENABLED = 'false';
    expect(gateway.isIngressEnabled()).toBe(false);
    const result = await gateway.handleV3WebhookIngress({}, { source: 'test' });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('ingress_disabled');
  });

  it('stores payload and enqueues before marking processed', async () => {
    const body = {
      data: {
        id: 'evt-1',
        event_type: 'call.initiated',
        payload: { call_control_id: 'leg-1', call_session_id: 'sess-1' },
      },
    };
    const result = await gateway.handleV3WebhookIngress(body, { source: 'test' });
    expect(result.accepted).toBe(true);
    expect(streams.storeIngressPayload).toHaveBeenCalledOnce();
    expect(streams.enqueueIngressJob).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadRef: expect.any(String),
        eventType: 'call.initiated',
      }),
    );
    expect(mockCreate).toHaveBeenCalledOnce();
    const enqueueOrder = vi.mocked(streams.enqueueIngressJob).mock.invocationCallOrder[0];
    const markOrder = mockCreate.mock.invocationCallOrder[0];
    expect(enqueueOrder).toBeLessThan(markOrder);
    const enqueueArgs = vi.mocked(streams.enqueueIngressJob).mock.calls[0][0];
    expect(enqueueArgs.payload).toBeUndefined();
  });

  it('returns duplicate without enqueue when durable duplicate exists', async () => {
    mockFindUnique.mockResolvedValue({ id: 'evt-dup' });
    const body = {
      data: {
        id: 'evt-dup',
        event_type: 'call.initiated',
        payload: { call_control_id: 'leg-1' },
      },
    };
    const result = await gateway.handleV3WebhookIngress(body, { source: 'test' });
    expect(result.duplicate).toBe(true);
    expect(streams.enqueueIngressJob).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
