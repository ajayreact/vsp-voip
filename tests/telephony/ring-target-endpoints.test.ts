import { describe, expect, it, vi } from 'vitest';
import {
  ENDPOINT_TYPES,
  discoverEndpoints,
  resolveAggregateEndpointType,
  isDeskOnlyRingTargets,
  hasMobileOrWebRtcRingTargets,
} from '../../lib/ringTargetEndpoints.js';

describe('ringTargetEndpoints / endpoint classification', () => {
  it('classifies Grandstream V3 desk device as desk endpoint on app routing target', () => {
    const endpoints = discoverEndpoints({
      extension: { id: 'ext-1', sipEnabled: true, webrtcEnabled: true, userId: 'user-1' },
      user: {
        id: 'user-1',
        telnyxSipUsername: 'gencred-employee',
        pushDeviceToken: null,
        sipRegistered: true,
      },
      v3DeskDevices: [{
        id: 'desk-1',
        status: 'REGISTERED',
        vendor: 'grandstream',
        lastRegistrationAt: new Date(),
      }],
      extensionDevices: [],
      userDevices: [],
    });

    expect(endpoints.some((e) => e.endpointType === ENDPOINT_TYPES.DESK)).toBe(true);
    expect(resolveAggregateEndpointType(endpoints, { routingType: 'app' })).toBe(ENDPOINT_TYPES.DESK);
  });

  it('does not count stale push token toward mixed endpointType', () => {
    const endpoints = discoverEndpoints({
      extension: { id: 'ext-1', sipEnabled: true, webrtcEnabled: true, userId: 'user-1' },
      user: {
        id: 'user-1',
        telnyxSipUsername: 'gencred-employee',
        pushDeviceToken: 'push-token',
        sipRegistered: true,
      },
      v3DeskDevices: [{ id: 'desk-1', status: 'REGISTERED', vendor: 'grandstream', lastRegistrationAt: new Date() }],
      extensionDevices: [],
      userDevices: [],
    });

    expect(endpoints.some((e) => e.source === 'push_token' && e.registered === false)).toBe(true);
    expect(resolveAggregateEndpointType(endpoints, { routingType: 'app' })).toBe(ENDPOINT_TYPES.DESK);
  });

  it('classifies legacy extension sip target as desk', () => {
    expect(resolveAggregateEndpointType([], { routingType: 'sip' })).toBe(ENDPOINT_TYPES.DESK);
  });

  it('defaults employee app routing without device inventory to mobile', () => {
    const endpoints = discoverEndpoints({
      extension: { id: 'ext-1', sipEnabled: true, userId: 'user-1' },
      user: { id: 'user-1', telnyxSipUsername: 'gencred-employee' },
      extensionDevices: [],
      v3DeskDevices: [],
      userDevices: [],
    });
    expect(resolveAggregateEndpointType(endpoints, { routingType: 'app' })).toBe(ENDPOINT_TYPES.MOBILE);
  });

  it('isDeskOnlyRingTargets requires every target endpointType desk', () => {
    expect(isDeskOnlyRingTargets([
      { type: 'app', endpointType: 'desk' },
      { type: 'app', endpointType: 'desk' },
    ])).toBe(true);
    expect(isDeskOnlyRingTargets([
      { type: 'app', endpointType: 'desk' },
      { type: 'app', endpointType: 'mixed' },
    ])).toBe(false);
  });
});

describe('ringTargetEndpoints / resolveExtensionRingTargets integration', () => {
  it('annotates app target with endpointType desk when V3 desk device is assigned', async () => {
    const prisma = {
      extensionDevice: { findMany: vi.fn().mockResolvedValue([]) },
      v3DeskDevice: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'desk-1',
          status: 'REGISTERED',
          vendor: 'grandstream',
          lastRegistrationAt: new Date(),
        }]),
      },
      userDevice: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findUnique: vi.fn() },
    };

    const { resolveExtensionRingTargets } = await import('../../lib/inboundRouting.js');
    const extension = {
      id: 'ext-101',
      tenantId: '00000000-0000-4000-8000-000000000001',
      extensionNumber: '101',
      displayName: 'Admin',
      userId: 'user-1',
      user: {
        id: 'user-1',
        name: 'Admin',
        telnyxSipUsername: 'gencred-admin',
      },
      sipEnabled: true,
      webrtcEnabled: true,
      telnyxSipUsername: 'legacy-desk',
    };

    const resolution = await resolveExtensionRingTargets(prisma, extension, 'conn-1');
    expect(resolution?.targets).toHaveLength(1);
    expect(resolution?.targets[0].type).toBe('app');
    expect(resolution?.targets[0].endpointType).toBe('desk');
    expect(resolution?.targets[0].deviceRingStrategy).toBe('DESK_FIRST');
    expect(resolution?.targets[0].user.telnyxSipUsername).toBe('gencred-admin');
  });
});
