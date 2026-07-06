import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  isDeskOnlyRingFirstPilotTenant,
  shouldDeferPstnAnswerForPilot,
} from '../../lib/telephony/deskRingFirstPilot.js';

const PILOT_TENANT_ID = '8bbcdbdf-6377-44a0-bd84-ac6a34d5de96';
const OTHER_TENANT_ID = 'not-a-pilot-tenant';

function makePrisma(deskExtensionIds: string[]) {
  const deskSet = new Set(deskExtensionIds);
  return {
    v3DeskDevice: {
      findFirst: async ({ where }: any) => {
        if (deskSet.has(where.extensionId)) {
          return { id: `device-${where.extensionId}` };
        }
        return null;
      },
    },
  };
}

const deskTarget = (extensionId: string) => ({ type: 'app', extensionId });
const phoneTarget = () => ({ type: 'phone', phone: '+13135551212' });

describe('Issue 1 fix — deskRingFirstPilot allowlist gate', () => {
  const ORIGINAL_ENV = process.env.DESK_RING_FIRST_PILOT_TENANT_IDS;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.DESK_RING_FIRST_PILOT_TENANT_IDS;
    } else {
      process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = ORIGINAL_ENV;
    }
  });

  it('is false when the allowlist env var is unset', () => {
    delete process.env.DESK_RING_FIRST_PILOT_TENANT_IDS;
    expect(isDeskOnlyRingFirstPilotTenant(PILOT_TENANT_ID)).toBe(false);
  });

  it('is true only for tenants in the comma-separated allowlist', () => {
    process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = `${PILOT_TENANT_ID}, some-other-id`;
    expect(isDeskOnlyRingFirstPilotTenant(PILOT_TENANT_ID)).toBe(true);
    expect(isDeskOnlyRingFirstPilotTenant(OTHER_TENANT_ID)).toBe(false);
  });

  it('is false for a null/undefined tenantId', () => {
    process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = PILOT_TENANT_ID;
    expect(isDeskOnlyRingFirstPilotTenant(null as any)).toBe(false);
    expect(isDeskOnlyRingFirstPilotTenant(undefined as any)).toBe(false);
  });
});

describe('Issue 1 fix — shouldDeferPstnAnswerForPilot', () => {
  const ORIGINAL_ENV = process.env.DESK_RING_FIRST_PILOT_TENANT_IDS;

  beforeEach(() => {
    process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = PILOT_TENANT_ID;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.DESK_RING_FIRST_PILOT_TENANT_IDS;
    } else {
      process.env.DESK_RING_FIRST_PILOT_TENANT_IDS = ORIGINAL_ENV;
    }
  });

  it('defers when every target is a provisioned desk phone on the pilot tenant', async () => {
    const prisma = makePrisma(['ext-101']);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [deskTarget('ext-101')],
      businessHoursClosed: false,
      extPolicyAction: null,
    });
    expect(result).toBe(true);
  });

  it('does not defer for a non-pilot tenant, even with desk-only targets', async () => {
    const prisma = makePrisma(['ext-101']);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: OTHER_TENANT_ID,
      targets: [deskTarget('ext-101')],
      businessHoursClosed: false,
      extPolicyAction: null,
    });
    expect(result).toBe(false);
  });

  it('does not defer when the tenant greeting is currently closed (business hours)', async () => {
    const prisma = makePrisma(['ext-101']);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [deskTarget('ext-101')],
      businessHoursClosed: true,
      extPolicyAction: null,
    });
    expect(result).toBe(false);
  });

  it('does not defer when an extension inbound policy other than ring applies', async () => {
    const prisma = makePrisma(['ext-101']);
    for (const action of ['block', 'voicemail', 'forward', 'screen']) {
      // eslint-disable-next-line no-await-in-loop
      const result = await shouldDeferPstnAnswerForPilot({
        prisma,
        tenantId: PILOT_TENANT_ID,
        targets: [deskTarget('ext-101')],
        businessHoursClosed: false,
        extPolicyAction: action,
      });
      expect(result).toBe(false);
    }
  });

  it('defers when the extension inbound policy action is explicitly "ring"', async () => {
    const prisma = makePrisma(['ext-101']);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [deskTarget('ext-101')],
      businessHoursClosed: false,
      extPolicyAction: 'ring',
    });
    expect(result).toBe(true);
  });

  it('does not defer when there are no ring targets', async () => {
    const prisma = makePrisma([]);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [],
      businessHoursClosed: false,
      extPolicyAction: null,
    });
    expect(result).toBe(false);
  });

  it('does not defer for non-app ring targets (e.g. external forward-to-phone)', async () => {
    const prisma = makePrisma([]);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [phoneTarget()],
      businessHoursClosed: false,
      extPolicyAction: null,
    });
    expect(result).toBe(false);
  });

  it('does not defer when a target has no provisioned desk device (mobile/WebRTC only)', async () => {
    const prisma = makePrisma([]);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [deskTarget('ext-999')],
      businessHoursClosed: false,
      extPolicyAction: null,
    });
    expect(result).toBe(false);
  });

  it('does not defer when only some of several targets are desk phones (ring group mixed with app)', async () => {
    const prisma = makePrisma(['ext-101']);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [deskTarget('ext-101'), deskTarget('ext-102')],
      businessHoursClosed: false,
      extPolicyAction: null,
    });
    expect(result).toBe(false);
  });

  it('defers when every target in a multi-target ring group is a provisioned desk phone', async () => {
    const prisma = makePrisma(['ext-101', 'ext-102']);
    const result = await shouldDeferPstnAnswerForPilot({
      prisma,
      tenantId: PILOT_TENANT_ID,
      targets: [deskTarget('ext-101'), deskTarget('ext-102')],
      businessHoursClosed: false,
      extPolicyAction: null,
    });
    expect(result).toBe(true);
  });
});
