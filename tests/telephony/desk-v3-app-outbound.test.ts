import { afterEach, describe, expect, it } from 'vitest';

describe('telephony / V3 Call Control Application outbound detection', () => {
  const originalLegacyApp = process.env.TELNYX_CALL_CONTROL_APP_ID;
  const originalV3App = process.env.TELNYX_V3_CALL_CONTROL_APP_ID;

  afterEach(() => {
    if (originalLegacyApp === undefined) delete process.env.TELNYX_CALL_CONTROL_APP_ID;
    else process.env.TELNYX_CALL_CONTROL_APP_ID = originalLegacyApp;
    if (originalV3App === undefined) delete process.env.TELNYX_V3_CALL_CONTROL_APP_ID;
    else process.env.TELNYX_V3_CALL_CONTROL_APP_ID = originalV3App;
  });

  it('detects V3 app parked desk outbound without matching legacy app', async () => {
    process.env.TELNYX_CALL_CONTROL_APP_ID = 'legacy-app-id';
    process.env.TELNYX_V3_CALL_CONTROL_APP_ID = 'v3-desk-app-id';

    const {
      isV3CallControlApplicationOutbound,
      isCallControlApplicationOutbound,
      isDeskOriginatedParkedOutbound,
    } = await import('../../lib/telephony/PayloadNormalizer.js');

    const payload = {
      direction: 'outgoing',
      state: 'parked',
      connection_id: 'v3-desk-app-id',
      call_control_id: 'cc-1',
    };

    expect(isDeskOriginatedParkedOutbound(payload)).toBe(true);
    expect(isV3CallControlApplicationOutbound(payload)).toBe(true);
    expect(isCallControlApplicationOutbound(payload, {})).toBe(false);
  });

  it('detects V3 outbound by Telnyx v3: call_control_id even with legacy connection_id', async () => {
    process.env.TELNYX_CALL_CONTROL_APP_ID = 'legacy-app-id';
    process.env.TELNYX_V3_CALL_CONTROL_APP_ID = 'v3-desk-app-id';

    const {
      isV3CallControlApplicationOutbound,
      isCallControlApplicationOutbound,
    } = await import('../../lib/telephony/PayloadNormalizer.js');

    const payload = {
      direction: 'outgoing',
      state: 'parked',
      connection_id: 'legacy-app-id',
      call_control_id: 'v3:90gwIqA4pvhAOMAaLooEYLt',
    };

    expect(isV3CallControlApplicationOutbound(payload)).toBe(true);
    expect(isCallControlApplicationOutbound(payload, {})).toBe(true);
  });

  it('legacy app outbound still matches legacy detector only', async () => {
    process.env.TELNYX_CALL_CONTROL_APP_ID = 'legacy-app-id';
    process.env.TELNYX_V3_CALL_CONTROL_APP_ID = 'v3-desk-app-id';

    const {
      isV3CallControlApplicationOutbound,
      isCallControlApplicationOutbound,
    } = await import('../../lib/telephony/PayloadNormalizer.js');

    const payload = {
      direction: 'outgoing',
      state: 'parked',
      connection_id: 'legacy-app-id',
      call_control_id: 'cc-2',
    };

    expect(isV3CallControlApplicationOutbound(payload)).toBe(false);
    expect(isCallControlApplicationOutbound(payload, {})).toBe(true);
  });
});
