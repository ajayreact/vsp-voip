import { afterEach, describe, expect, it, vi } from 'vitest';

const { classifyDestinationKind } = require('../../lib/telephony/DestinationResolver');
const deskResolver = require('../../lib/telephony-v3/Routing/deskResolver');
const { ROUTING_FLOW, DESTINATION_TYPE } = require('../../lib/telephony-v3/Routing/deskRouteResult');

describe('V3 deskResolver helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('classifies extension destination from numeric to', () => {
    const kind = classifyDestinationKind('102');
    expect(kind.kind).toBe('EXTENSION');
    expect(kind.extensionNumber).toBe('102');
  });

  it('classifies PSTN destination from e164 to', () => {
    const kind = classifyDestinationKind('+15551234567');
    expect(kind.kind).toBe('PSTN');
  });
});
