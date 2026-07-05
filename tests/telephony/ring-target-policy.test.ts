import { describe, expect, it } from 'vitest';
import {
  EXTENSION_DEVICE_RING_STRATEGY,
  resolveDeviceRingStrategy,
  usesRingFirstPath,
  usesOptionARingPath,
  targetUsesRingFirst,
  targetUsesOptionA,
} from '../../lib/ringTargetPolicy.js';
import { ENDPOINT_TYPES } from '../../lib/ringTargetEndpoints.js';

describe('ringTargetPolicy / extension deviceRingStrategy from DB', () => {
  const ext101DeskTarget = {
    type: 'app',
    endpointType: ENDPOINT_TYPES.DESK,
    deviceRingStrategy: EXTENSION_DEVICE_RING_STRATEGY.DESK_FIRST,
    user: {
      id: 'user-1',
      telnyxSipUsername: 'gencred-admin',
      pushDeviceToken: 'stale-push-token',
    },
    endpoints: [
      {
        endpointType: ENDPOINT_TYPES.DESK,
        source: 'v3_desk_device',
        registered: true,
      },
      {
        endpointType: ENDPOINT_TYPES.MOBILE,
        source: 'push_token',
        registered: false,
        pushInstalled: true,
      },
    ],
  };

  it('resolves DESK_FIRST from extension.deviceRingStrategy', () => {
    expect(resolveDeviceRingStrategy({
      id: 'ext-101',
      tenantId: '8bbcdbdf-6377-44a0-bd84-ac6a34d5de96',
      extensionNumber: '101',
      deviceRingStrategy: EXTENSION_DEVICE_RING_STRATEGY.DESK_FIRST,
    })).toBe(EXTENSION_DEVICE_RING_STRATEGY.DESK_FIRST);
  });

  it('defaults to SIMULTANEOUS when deviceRingStrategy is missing', () => {
    expect(resolveDeviceRingStrategy({
      id: 'ext-100',
      tenantId: '8bbcdbdf-6377-44a0-bd84-ac6a34d5de96',
      extensionNumber: '100',
    })).toBe(EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS);
    expect(resolveDeviceRingStrategy(null)).toBe(EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS);
  });

  it('extension with desk + stale push uses ring-first when DESK_FIRST', () => {
    expect(targetUsesOptionA(ext101DeskTarget)).toBe(false);
    expect(targetUsesRingFirst(ext101DeskTarget)).toBe(true);
    expect(usesOptionARingPath([ext101DeskTarget])).toBe(false);
    expect(usesRingFirstPath([ext101DeskTarget])).toBe(true);
  });

  it('extension keeps target.type app while policy selects ring-first', () => {
    expect(ext101DeskTarget.type).toBe('app');
    expect(ext101DeskTarget.endpointType).toBe(ENDPOINT_TYPES.DESK);
  });
});

describe('ringTargetPolicy / SIMULTANEOUS legacy behavior', () => {
  const simultaneousDeskPushTarget = {
    type: 'app',
    endpointType: ENDPOINT_TYPES.DESK,
    deviceRingStrategy: EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS,
    user: {
      id: 'user-2',
      telnyxSipUsername: 'gencred-user',
      pushDeviceToken: 'push-token',
    },
    endpoints: [
      {
        endpointType: ENDPOINT_TYPES.DESK,
        source: 'extension_device',
        registered: true,
      },
      {
        endpointType: ENDPOINT_TYPES.MOBILE,
        source: 'push_token',
        registered: false,
      },
    ],
  };

  it('SIMULTANEOUS with installed push still uses Option A', () => {
    expect(targetUsesOptionA(simultaneousDeskPushTarget)).toBe(true);
    expect(usesRingFirstPath([simultaneousDeskPushTarget])).toBe(false);
  });

  it('SIMULTANEOUS with active mobile WebRTC uses Option A', () => {
    const target = {
      type: 'app',
      endpointType: ENDPOINT_TYPES.MIXED,
      deviceRingStrategy: EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS,
      user: { id: 'u1', telnyxSipUsername: 'cred' },
      endpoints: [
        { endpointType: ENDPOINT_TYPES.DESK, source: 'v3_desk_device', registered: true },
        { endpointType: ENDPOINT_TYPES.WEBRTC, source: 'user_softphone_online', registered: true },
      ],
    };
    expect(usesOptionARingPath([target])).toBe(true);
    expect(usesRingFirstPath([target])).toBe(false);
  });

  it('mobile-only employee under SIMULTANEOUS uses Option A', () => {
    const target = {
      type: 'app',
      endpointType: ENDPOINT_TYPES.MOBILE,
      deviceRingStrategy: EXTENSION_DEVICE_RING_STRATEGY.SIMULTANEOUS,
      user: { id: 'u1', telnyxSipUsername: 'cred' },
      endpoints: [],
    };
    expect(usesOptionARingPath([target])).toBe(true);
  });
});
